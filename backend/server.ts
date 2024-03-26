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

interface Message {
  user: string;
  msg: string;
  ack: boolean;
}

interface ConnectionObject {
  user: string;
  groupname: string;
}

loadEnv();

const serverID = uuidv4();

const serverlist = new Set<WebSocket>();

for (const host of process.env.DB_HOSTLIST!.split(",")) {
  const currentTimer = setTimeout(() => {
    const currSocket = new WebSocket(host + "/socket");

    const reconnect = (_: any) => {
      serverlist.delete(currSocket);
      currentTimer.refresh();
    };

    currSocket.onclose = reconnect;
    currSocket.onerror = reconnect;

    currSocket.onopen = (_) => {
      console.log("Connected to:", currSocket.url);
      currSocket.send(
        JSON.stringify({ operation: "REGISTER_SERVER", payload: { serverID } })
      );
      serverlist.add(currSocket);
    };

    currSocket.onmessage = (msg) => {
      if (msg.data === "REQUESTED_SELF_REGISTER") {
        console.log(
          "Unregistering own server from serverlist:",
          currSocket.url
        );
        clearInterval(currentTimer);
        currSocket.onclose = null;
        currSocket.close();
        serverlist.delete(currSocket);
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

const disconnect = (conn: SocketStream) => {
  const userInfo = conns.get(conn)!;
  if (userInfo) {
    const oldGroup = groups.get(userInfo.groupname);

    oldGroup!.users.delete(userInfo.user);
    oldGroup!.conns.delete(conn);
    conns.delete(conn);

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
        case "REGISTER_SERVER":
          console.log("Registering new server");
          if (requestJson.payload!["serverID"] !== serverID) {
            conn.socket.send("REGISTERED");
          } else {
            conn.socket.send("REQUESTED_SELF_REGISTER");
          }
          break;

        case "CREATE_OR_JOIN_GROUP":
          if (!group) {
            console.log(
              "Group:",
              groupname,
              "does not exist locally. Creating"
            );
            group = { users: new Set(), conns: new Set() };
          } else if (group.users.has(user)) {
            console.log("User: " + user + " is already in group");
            response = {
              operation: "NAME_ALREADY_TAKEN_FOR_GROUP",
            };
            conn.socket.send(JSON.stringify(response));
            break;
          } else if (conns.has(conn)) {
            disconnect(conn);
          }

          group.users.add(user);
          group.conns.add(conn);

          conns.set(conn, { groupname, user });
          groups.set(groupname, group);

          response = {
            operation: "GROUP_JOINED",
          };

          console.log("User", user, "joined group", groupname);

          conn.socket.send(JSON.stringify(response));
          break;

        case "SEND_MESSAGE":
          const newMsg = requestJson.payload!.msg;
          console.log("Received message:", requestJson);

          if (!requestJson.fromServer) {
            for (const server of serverlist) {
              server.send(
                JSON.stringify({
                  operation: "SEND_MESSAGE",
                  fromServer: true,
                  payload: { groupname, user, msg: newMsg },
                })
              );
            }
          }

          if (group) {
            console.log(
              "New Message received in Group:",
              groupname,
              "Msg:",
              newMsg
            );

            group.conns.forEach((conn) => {
              conn.socket.send(
                JSON.stringify({
                  operation: "NEW_MESSAGE",
                  payload: { user, msg: newMsg },
                })
              );
            });
          }
          break;
      }
    });

    conn.socket.on("close", () => disconnect(conn));
  });
});

const { BACKEND_HOST, BACKEND_PORT } = process.env;

console.log(process.argv[2]);
const portInput = process.argv[2];
const port = portInput ? Number(portInput) : Number(BACKEND_PORT);

server.listen({ host: BACKEND_HOST, port }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
