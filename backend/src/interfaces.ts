import { SocketStream } from "@fastify/websocket";

export interface Group {
  users: Set<string>;
  conns: Set<SocketStream>;
}

export interface ConnectionObject {
  id: string;
  user: string;
  groupname: string;
}
