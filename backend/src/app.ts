import * as FastifyStatic from "@fastify/static";
import * as FastifyWebSocket from "@fastify/websocket";
import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";

import { SocketStream } from "@fastify/websocket";
import { config as loadEnv } from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { ChatOperations } from "./chatOperations";
import {
  connectServers,
  disconnect,
  rec_ackMessage,
  rec_createOrJoinGroup,
  rec_sendMessage,
  rec_serverGroupJoin,
  rec_serverGroupLeft,
  rec_serverRegister,
} from "./helper";
import { ConnectionObject, Group } from "./interfaces";

loadEnv();

const serverID = uuidv4();
const serverList = new Map<string, WebSocket>();
const groups: Map<string, Group> = new Map();
const conns: Map<SocketStream, ConnectionObject> = new Map();
const messageQueue: Map<string, any> = new Map();
const queueTimer = setTimeout(() => {
  messageQueue.forEach((value, _) => {
    value.conn.socket.send(JSON.stringify(value.newMsg));
  });
  queueTimer.refresh();
}, 6969);

export default function build(opts: FastifyServerOptions = {}): {
  app: FastifyInstance;
  disconnectServers: () => void;
} {
  const app = Fastify(opts);

  app.register(FastifyWebSocket);

  app.register(FastifyStatic, {
    root: process.cwd() + "/public",
  });

  app.register(async (server: FastifyInstance) => {
    server.get("/", async (_request, _reply) => {
      return _reply.sendFile("./index.html");
    });

    server.get("/socket", { websocket: true }, (conn: SocketStream) => {
      // Client has been connected. Send active groups to client.

      conn.socket.on("message", async (request) => {
        const requestJson = JSON.parse(request.toString());

        const groupname = requestJson.payload?.groupname;
        const user = requestJson.payload?.user;

        let group = groups.get(groupname);

        switch (requestJson.operation) {
          case ChatOperations.SEND_MESSAGE:
            rec_sendMessage(
              requestJson,
              group,
              groupname,
              conn,
              serverID,
              serverList,
              conns,
              messageQueue
            );
            break;

          case ChatOperations.CREATE_OR_JOIN_GROUP:
            rec_createOrJoinGroup(
              group,
              groupname,
              user,
              conn,
              serverList,
              groups,
              conns
            );
            break;
          case ChatOperations.SERVER_GROUP_JOIN:
            rec_serverGroupJoin(group, groupname, user, groups);
            break;

          case ChatOperations.SERVER_GROUP_LEFT:
            rec_serverGroupLeft(group, user);
            break;
          case ChatOperations.ACKNOWLEDGE_MESSAGE:
            rec_ackMessage(
              conns.get(conn)!.id + "_" + requestJson.payload.timestamp,
              messageQueue,
              serverID
            );
            break;

          case ChatOperations.SERVER_REGISTER:
            rec_serverRegister(requestJson, conn, serverID);
            break;
        }
      });

      conn.socket.on("close", () =>
        disconnect(conn, conns, groups, serverList)
      );
    });
  });
  const serverTimers = connectServers(serverID, serverList, messageQueue);

  return {
    app,
    disconnectServers: () => {
      clearTimeout(queueTimer);

      serverTimers.forEach((timer) => {
        clearTimeout(timer);
      });

      conns.forEach((_, conn) => {
        conn.socket.close();
      });

      serverList.forEach((socket: WebSocket) => {
        socket.close();
      });
    },
  };
}
