import * as FastifyStatic from "@fastify/static";
import * as FastifyWebSocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";

import { SocketStream } from "@fastify/websocket";
import { config as loadEnv } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";

interface Group {
  users: Set<string>;
  conns: Set<SocketStream>;
}

interface ConnectionObject {
  user: string;
  groupname: string;
}

enum ChatOperations {
  SEND_MESSAGE = "SEND_MESSAGE",
  NEW_MESSAGE = "NEW_MESSAGE",
  ACKNOWLEDGE_MESSAGE = "ACKNOWLEDGE_MESSAGE",
  MESSAGE_DONE = "placeholder",

  CREATE_OR_JOIN_GROUP = "CREATE_OR_JOIN_GROUP",
  NAME_ALREADY_TAKEN_FOR_GROUP = "NAME_ALREADY_TAKEN_FOR_GROUP",
  GROUP_JOINED = "GROUP_JOINED",

  SERVER_GROUP_JOIN = "SERVER_GROUP_JOIN",
  SERVER_GROUP_LEFT = "SERVER_GROUP_LEFT",

  SERVER_REGISTER = "SERVER_REGISTER",
  SERVER_REQUESTED_SELF_REGISTER = "SERVER_REQUESTED_SELF_REGISTER",
  SERVER_REGISTERED = "SERVER_REGISTERED",
}

loadEnv();

const serverID = uuidv4();

const serverlist = new Map<string, WebSocket>();
const hosts = process.env.DB_HOSTLIST!.split(",");
for (let host of hosts) {
  const currSocket = new WebSocket(host + "/socket");
  currSocket.onerror = (err) => {};

  currSocket.onclose = () => {
    console.log("Unregistering own server from serverlist:", currSocket.url);
    serverlist.forEach((value, key) => {
      if (checkUndefined(key)) {
        return;
      } else if (value == currSocket) {
        serverlist.delete(key);
      }
    });
  };

  currSocket.onmessage = (msg) => {
    const message = JSON.parse(msg.data.toString());

    if (message.operation == ChatOperations.SERVER_REQUESTED_SELF_REGISTER) {
      console.log("Unregistering own server from serverlist:", currSocket.url);
      currSocket.onclose = null;
      currSocket.close();
    } else if (message.operation == ChatOperations.SERVER_REGISTERED) {
      serverlist.set(message.payload.serverID, currSocket);
      currSocket["_socket"]._peername = {
        id: message.payload.serverID,
      };
      console.log("Registered server:", currSocket.url);
    } else {
      onMessage(message, { socket: currSocket });
    }
  };

  currSocket.onopen = () => {
    currSocket.send(
      JSON.stringify({
        operation: ChatOperations.SERVER_REGISTER,
        payload: { serverID },
      })
    );
  };
}

const server: FastifyInstance = Fastify({ logger: true });
server.register(FastifyWebSocket);

server.register(FastifyStatic, {
  root: process.cwd() + "/public",
});

const groups: Map<string, Group> = new Map();

const conns: Map<string, ConnectionObject> = new Map();

const messageQueue: Map<string, any> = new Map();

const disconnect = (conn: SocketStream) => {
  const connectionID =
    conn.socket["_socket"]._peername.address +
    ":" +
    conn.socket["_socket"]._peername.port;

  const userInfo = conns.get(connectionID)!;
  if (userInfo) {
    const oldGroup = groups.get(userInfo.groupname);

    oldGroup!.users.delete(userInfo.user);
    oldGroup!.conns.delete(conn);
    conns.delete(connectionID);
    messageQueue.forEach((value, key) => {
      value.send(
        JSON.stringify({
          operation: ChatOperations.SERVER_GROUP_LEFT,
          payload: { user: userInfo.user, groupname: userInfo.groupname },
        })
      );
    });
    console.log(
      "User:",
      userInfo.user,
      "in Group:",
      userInfo.groupname,
      "has been disconnected"
    );
  }
};

const checkUndefined = (key) => {
  if (key == undefined) {
    serverlist.delete(key);
    return true;
  }
  return false;
};

server.register(async (server: FastifyInstance) => {
  server.get("/", async (_request, _reply) => {
    return _reply.sendFile("./index.html");
  });

  server.post("/socketLoop", async (request, _reply) => {
    const toTry = process.env.DB_HOSTLIST!.split(",")[0];
    const timer = setTimeout(() => {
      new WebSocket(toTry + "/socket").onerror = () => {};
      timer.refresh();
    }, 0);
  });

  server.get("/groups", async (_request, _reply) => {
    return Array.from(groups.keys());
  });

  server.delete("/groups", async (_request, _reply) => {
    return groups.clear();
  });

  server.get("/socket", { websocket: true }, (conn: SocketStream) => {
    // Client has been connected. Send active groups to client.
    conn.socket.on("close", () => disconnect(conn));

    conn.socket.on("message", (request) => {
      const requestJson = JSON.parse(request.toString());
      conn.socket["_socket"]._peername.id =
        conn.socket["_socket"]._peername.address +
        ":" +
        conn.socket["_socket"]._peername.port;
      onMessage(requestJson, conn);
    });
  });
});

const onMessage = async (request, conn) => {
  const groupname = request.payload?.groupname;
  const user = request.payload?.user;

  const connectionID = conn.socket["_socket"]._peername.id;

  let response = {};
  let group = groups.get(groupname);

  switch (request.operation) {
    case ChatOperations.SEND_MESSAGE:
      const newMsg = request;

      if (group) {
        if (newMsg.serverID && group.conns.size == 0) {
          console.log(
            "No local user in group:",
            groupname,
            "| Sending acknowledgement to server."
          );
          conn.socket.send(
            JSON.stringify({
              operation: ChatOperations.ACKNOWLEDGE_MESSAGE,
              payload: {
                timestamp: newMsg.payload.timestamp,
                fromServer: serverID,
              },
            })
          );
        }

        console.log("New Message received in Group:", groupname);

        if (!newMsg.serverID) {
          newMsg.serverID = serverID;

          serverlist.forEach((value, key) => {
            if (checkUndefined(key)) {
              return;
            }
            messageQueue.set(key + "_" + newMsg.payload.timestamp, {
              conn,
              newMsg,
            });
            value.send(JSON.stringify(newMsg));
          });
        }

        newMsg.operation = ChatOperations.NEW_MESSAGE;

        group.conns.forEach((conn) => {
          conn.socket.send(JSON.stringify(newMsg));
          messageQueue.set(
            conn.socket["_socket"]._peername.id +
              "_" +
              newMsg.payload.timestamp,
            {
              conn,
              newMsg,
            }
          );
        });
      }
      break;

    case ChatOperations.CREATE_OR_JOIN_GROUP:
      if (!group) {
        console.log("Group:", groupname, "does not exist locally. Creating");
        group = { users: new Set(), conns: new Set() };
      } else if (group.users.has(user)) {
        console.log("User: " + user + " is already in group", groupname);
        response = {
          operation: ChatOperations.NAME_ALREADY_TAKEN_FOR_GROUP,
        };
        conn.socket.send(JSON.stringify(response));
        break;
      } else if (conns.has(connectionID)) {
        disconnect(conn);
      }

      group.users.add(user);
      group.conns.add(conn);

      conns.set(connectionID, { groupname, user });
      groups.set(groupname, group);

      serverlist.forEach((socket: WebSocket, key: string) => {
        if (checkUndefined(key)) {
          return;
        }
        socket.send(
          JSON.stringify({
            operation: ChatOperations.SERVER_GROUP_JOIN,
            payload: {
              user,
              groupname,
            },
          })
        );
      });

      conn.socket.send(
        JSON.stringify({
          operation: ChatOperations.GROUP_JOINED,
        })
      );
      console.log("User", user, "joined group", groupname);
      break;
    case ChatOperations.SERVER_GROUP_JOIN:
      if (!group) {
        console.log("Group:", groupname, "does not exist locally. Creating");
        group = { users: new Set(), conns: new Set() };
        groups.set(groupname, group);
      }
      group.users.add(user);
      break;

    case ChatOperations.SERVER_GROUP_LEFT:
      if (group) {
        group.users.delete(user);
      }
      break;
    case ChatOperations.ACKNOWLEDGE_MESSAGE:
      if (!!request.payload.fromServer) {
        ackMessage(
          request.payload.fromServer + "_" + request.payload.timestamp
        );
      } else {
        ackMessage(connectionID + "_" + request.payload.timestamp);
      }
      break;

    case ChatOperations.SERVER_REGISTER:
      const incomingServerID = request.payload!["serverID"];
      if (incomingServerID == serverID) {
        conn.socket.send(
          JSON.stringify({
            operation: ChatOperations.SERVER_REQUESTED_SELF_REGISTER,
          })
        );
        break;
      } else if (incomingServerID) {
        serverlist.set(incomingServerID, conn.socket);
        conn.socket.onclose = () => {
          console.log("Unregistering server:", incomingServerID);
          serverlist.delete(incomingServerID);
        };
        conn.socket.send(
          JSON.stringify({
            operation: ChatOperations.SERVER_REGISTERED,
            payload: { serverID },
          })
        );
        console.log("Registered server:", incomingServerID);
        break;
      }
      break;
    case ChatOperations.MESSAGE_DONE:
      ackMessage(request.payload.ackedServer + "_" + request.payload.timestamp);
      break;
  }
};

const { BACKEND_HOST, BACKEND_PORT } = process.env;

const portInput = process.argv[2];
const port = portInput ? Number(portInput) : Number(BACKEND_PORT);

server.listen({ host: BACKEND_HOST, port }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
function ackMessage(id: any) {
  console.log("Acknowledging message:", id);

  const currQueueItem = messageQueue.get(id);

  messageQueue.delete(id);

  const timestamp = id.split("_")[1];
  let isDone = true;

  messageQueue.forEach((value, key) => {
    if (key.endsWith(timestamp)) {
      isDone = false;
    }
  });

  if (isDone) {
    const payload = currQueueItem.newMsg.payload;
    if (currQueueItem.newMsg.serverID != serverID) {
      console.log("Message is done:", id, "Sending to server.");
      payload.ackedServer = serverID;
      serverlist.get(currQueueItem.newMsg.serverID).send(
        JSON.stringify({
          operation: ChatOperations.MESSAGE_DONE,
          payload,
        })
      );
    } else {
      currQueueItem.conn.socket.send(
        JSON.stringify({
          operation: ChatOperations.MESSAGE_DONE,
          payload,
        })
      );
    }
  }
}

setInterval(() => {
  messageQueue.forEach((value, key) => {
    value.conn.socket.send(JSON.stringify(value.newMsg));
  });
}, 5000);
