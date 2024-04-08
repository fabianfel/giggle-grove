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
  id: string;
  user: string;
  groupname: string;
}

enum ChatOperations {
  SEND_MESSAGE = "SEND_MESSAGE",
  NEW_MESSAGE = "NEW_MESSAGE",
  ACKNOWLEDGE_MESSAGE = "ACKNOWLEDGE_MESSAGE",
  placeholder = "placeholder",

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

for (const host of process.env.DB_HOSTLIST!.split(",")) {
  const currentTimer = setTimeout(() => {
    const currSocket = new WebSocket(host + "/socket");

    const reconnect = (_: any) => {
      serverlist.forEach((socket: WebSocket, key: string) => {
        if (socket == currSocket) {
          serverlist.delete(key);
        }
      });
      currentTimer.refresh();
    };

    currSocket.onclose = reconnect;
    currSocket.onerror = reconnect;

    currSocket.onopen = (_) => {
      currSocket.send(
        JSON.stringify({
          operation: ChatOperations.SERVER_REGISTER,
          payload: { serverID },
        })
      );
    };

    currSocket.onmessage = (msg) => {
      const message = JSON.parse(msg.data.toString());
      if (message.operation == ChatOperations.placeholder) {
        ackMessage(serverID + "_" + message.payload.timestamp);
      } else if (
        message.operation == ChatOperations.SERVER_REQUESTED_SELF_REGISTER
      ) {
        console.log(
          "Unregistering own server from serverlist:",
          currSocket.url
        );
        clearInterval(currentTimer);
        currSocket.onclose = null;
        currSocket.close();
      } else if ((message.operation = ChatOperations.SERVER_REGISTERED)) {
        serverlist.set(message.payload.serverID, currSocket);
        console.log("Registered server:", currSocket.url);
      }
    };
  }, 1000);
}

const server: FastifyInstance = Fastify({ logger: true });
server.register(FastifyWebSocket);

server.register(FastifyStatic, {
  root: process.cwd() + "/public",
});

const groups: Map<string, Group> = new Map();

const conns: Map<SocketStream, ConnectionObject> = new Map();

const messageQueue: Map<string, any> = new Map();

const disconnect = (conn: SocketStream) => {
  const userInfo = conns.get(conn)!;
  if (userInfo) {
    const oldGroup = groups.get(userInfo.groupname);

    oldGroup!.users.delete(userInfo.user);
    oldGroup!.conns.delete(conn);
    conns.delete(conn);
    serverlist.forEach((socket: WebSocket) => {
      socket.send(
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

    conn.socket.on("message", async (request) => {
      const requestJson = JSON.parse(request.toString());

      const groupname = requestJson.payload?.groupname;
      const user = requestJson.payload?.user;

      let response = {};
      let group = groups.get(groupname);

      switch (requestJson.operation) {
        case ChatOperations.SEND_MESSAGE:
          const newMsg = requestJson;

          if (group) {
            console.log("New Message received in Group:", groupname);
            newMsg.operation = ChatOperations.NEW_MESSAGE;

            group.conns.forEach((conn) => {
              conn.socket.send(JSON.stringify(newMsg));
              messageQueue.set(
                conns.get(conn)!.id + "_" + newMsg.payload.timestamp,
                {
                  conn,
                  newMsg,
                }
              );
            });
          } else if (newMsg.serverID) {
            console.log(
              "Group:",
              groupname,
              "does not exist locally. sending acknowledgement to server"
            );
            conn.socket.send(
              JSON.stringify({
                operation: ChatOperations.placeholder,
                payload: {
                  timestamp: newMsg.payload.timestamp,
                  fromServer: serverID,
                },
              })
            );
          }

          if (!newMsg.serverID) {
            newMsg.serverID = serverID;

            serverlist.forEach((value, key) => {
              messageQueue.set(key + "_" + newMsg.payload.timestamp, {
                conn,
                newMsg,
              });

              value.send(JSON.stringify(newMsg));
            });
          }
          break;

        case ChatOperations.CREATE_OR_JOIN_GROUP:
          if (!group) {
            console.log(
              "Group:",
              groupname,
              "does not exist locally. Creating"
            );
            group = { users: new Set(), conns: new Set() };
          } else if (group.users.has(user)) {
            console.log("User: " + user + " is already in group", groupname);
            response = {
              operation: ChatOperations.NAME_ALREADY_TAKEN_FOR_GROUP,
            };
            conn.socket.send(JSON.stringify(response));
            break;
          } else if (conns.has(conn)) {
            disconnect(conn);
          }

          group.users.add(user);
          group.conns.add(conn);

          conns.set(conn, { id: uuidv4(), groupname, user });
          groups.set(groupname, group);

          serverlist.forEach((socket: WebSocket) => {
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
            console.log(
              "Group:",
              groupname,
              "does not exist locally. Creating"
            );
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
          ackMessage(conns.get(conn)!.id + "_" + requestJson.payload.timestamp);
          break;

        case ChatOperations.SERVER_REGISTER:
          if (requestJson.payload!["serverID"] == serverID) {
            conn.socket.send(
              JSON.stringify({
                operation: ChatOperations.SERVER_REQUESTED_SELF_REGISTER,
              })
            );
            break;
          }
          conn.socket.send(
            JSON.stringify({
              operation: ChatOperations.SERVER_REGISTERED,
              payload: { serverID },
            })
          );
          break;
      }
    });

    conn.socket.on("close", () => disconnect(conn));
  });
});

const queueTimer = setTimeout(() => {
  messageQueue.forEach((value, _) => {
    value.conn.socket.send(JSON.stringify(value.newMsg));
  });
  queueTimer.refresh();
}, 6969);

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
  for (let queueItem in messageQueue) {
    if (queueItem[0].endsWith(timestamp)) {
      isDone = false;
      break;
    }
  }

  if (isDone) {
    currQueueItem.conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.placeholder,
        payload: { serverID, timestamp },
      })
    );
  }
}
