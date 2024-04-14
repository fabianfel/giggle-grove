import * as FastifyStatic from "@fastify/static";
import * as FastifyWebSocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";

import { SocketStream } from "@fastify/websocket";
import { config as loadEnv } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { ChatOperations } from "./chatoperations";
import { ConnectionObject, Group } from "./interfaces";
import {
  rec_ackMessage,
  rec_createOrJoinGroup,
  rec_sendMessage,
  rec_serverGroupJoin,
  rec_serverGroupLeft,
  rec_serverRegister,
} from "./messagehelper";

loadEnv();

export const SERVER_ID = uuidv4();

export const SERVER_LIST = new Map<string, WebSocket>();

for (const host of process.env.DB_HOSTLIST!.split(",")) {
  const currentTimer = setTimeout(() => {
    const currSocket = new WebSocket(host + "/socket");

    const reconnect = (_: any) => {
      SERVER_LIST.forEach((socket: WebSocket, key: string) => {
        if (socket == currSocket) {
          SERVER_LIST.delete(key);
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
          payload: { serverID: SERVER_ID },
        })
      );
    };

    currSocket.onmessage = (msg) => {
      const message = JSON.parse(msg.data.toString());
      if (message.operation == ChatOperations.placeholder) {
        rec_ackMessage(SERVER_ID + "_" + message.payload.timestamp);
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
        SERVER_LIST.set(message.payload.serverID, currSocket);
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

export const GROUPS: Map<string, Group> = new Map();

export const CONNS: Map<SocketStream, ConnectionObject> = new Map();

export const MESSAGE_QUEUE: Map<string, any> = new Map();

server.register(async (server: FastifyInstance) => {
  server.get("/", async (_request, _reply) => {
    return _reply.sendFile("./index.html");
  });

  server.get("/socket", { websocket: true }, (conn: SocketStream) => {
    // Client has been connected. Send active groups to client.

    conn.socket.on("message", async (request) => {
      const requestJson = JSON.parse(request.toString());

      const groupname = requestJson.payload?.groupname;
      const user = requestJson.payload?.user;

      let group = GROUPS.get(groupname);

      switch (requestJson.operation) {
        case ChatOperations.SEND_MESSAGE:
          rec_sendMessage(requestJson, group, groupname, conn);
          break;

        case ChatOperations.CREATE_OR_JOIN_GROUP:
          rec_createOrJoinGroup(group, groupname, user, conn);
          break;
        case ChatOperations.SERVER_GROUP_JOIN:
          rec_serverGroupJoin(group, groupname, user);
          break;

        case ChatOperations.SERVER_GROUP_LEFT:
          rec_serverGroupLeft(group, user);
          break;
        case ChatOperations.ACKNOWLEDGE_MESSAGE:
          rec_ackMessage(
            CONNS.get(conn)!.id + "_" + requestJson.payload.timestamp
          );
          break;

        case ChatOperations.SERVER_REGISTER:
          rec_serverRegister(requestJson, conn);
          break;
      }
    });

    conn.socket.on("close", () => disconnect(conn));
  });
});

const queueTimer = setTimeout(() => {
  MESSAGE_QUEUE.forEach((value, _) => {
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
export function disconnect(conn: SocketStream) {
  const userInfo = CONNS.get(conn)!;
  if (userInfo) {
    const oldGroup = GROUPS.get(userInfo.groupname);

    oldGroup!.users.delete(userInfo.user);
    oldGroup!.conns.delete(conn);
    CONNS.delete(conn);
    SERVER_LIST.forEach((socket: WebSocket) => {
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
}
