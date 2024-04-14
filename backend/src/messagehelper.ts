import { SocketStream } from "@fastify/websocket";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { ChatOperations } from "./chatoperations";
import { Group } from "./interfaces";
import {
  CONNS,
  GROUPS,
  MESSAGE_QUEUE,
  SERVER_ID,
  SERVER_LIST,
  disconnect,
} from "./server";

export function rec_sendMessage(
  requestJson: any,
  group: Group | undefined,
  groupname: any,
  conn: SocketStream
) {
  const newMsg = requestJson;

  if (group) {
    console.log("New Message received in Group:", groupname);
    newMsg.operation = ChatOperations.NEW_MESSAGE;

    group.conns.forEach((conn) => {
      conn.socket.send(JSON.stringify(newMsg));
      MESSAGE_QUEUE.set(CONNS.get(conn)!.id + "_" + newMsg.payload.timestamp, {
        conn,
        newMsg,
      });
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
          fromServer: SERVER_ID,
        },
      })
    );
  }

  if (!newMsg.serverID) {
    newMsg.serverID = SERVER_ID;

    SERVER_LIST.forEach((value, key) => {
      MESSAGE_QUEUE.set(key + "_" + newMsg.payload.timestamp, {
        conn,
        newMsg,
      });

      value.send(JSON.stringify(newMsg));
    });
  }
}

export function rec_createOrJoinGroup(group, groupname, user, conn) {
  if (!group) {
    console.log("Group:", groupname, "does not exist locally. Creating");
    group = { users: new Set(), conns: new Set() };
  } else if (group.users.has(user)) {
    console.log("User: " + user + " is already in group", groupname);
    conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.NAME_ALREADY_TAKEN_FOR_GROUP,
      })
    );
    return;
  } else if (CONNS.has(conn)) {
    disconnect(conn);
  }

  group.users.add(user);
  group.conns.add(conn);

  CONNS.set(conn, { id: uuidv4(), groupname, user });
  GROUPS.set(groupname, group);

  SERVER_LIST.forEach((socket: WebSocket) => {
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
}

export function rec_serverGroupJoin(group, groupname, user) {
  if (!group) {
    console.log("Group:", groupname, "does not exist locally. Creating");
    group = { users: new Set(), conns: new Set() };
    GROUPS.set(groupname, group);
  }
  group.users.add(user);
}
export function rec_serverGroupLeft(group, user) {
  if (group) {
    group.users.delete(user);
  }
}
export function rec_ackMessage(id: any) {
  console.log("Acknowledging message:", id);

  const currQueueItem = MESSAGE_QUEUE.get(id);
  MESSAGE_QUEUE.delete(id);
  const timestamp = id.split("_")[1];
  let isDone = true;
  for (let queueItem in MESSAGE_QUEUE) {
    if (queueItem[0].endsWith(timestamp)) {
      isDone = false;
      break;
    }
  }

  if (isDone) {
    const payload = currQueueItem.newMsg.payload;
    payload.serverID = SERVER_ID;
    currQueueItem.conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.placeholder,
        payload,
      })
    );
  }
}

export function rec_serverRegister(requestJson: any, conn: SocketStream) {
  if (requestJson.payload!["serverID"] == SERVER_ID) {
    conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.SERVER_REQUESTED_SELF_REGISTER,
      })
    );
  }
  conn.socket.send(
    JSON.stringify({
      operation: ChatOperations.SERVER_REGISTERED,
      payload: { SERVER_ID },
    })
  );
}
