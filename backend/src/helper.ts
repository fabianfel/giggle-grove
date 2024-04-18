import { SocketStream } from "@fastify/websocket";
import { v4 as uuidv4 } from "uuid";
import { WebSocket } from "ws";
import { ChatOperations } from "./chatOperations";
import { ConnectionObject, Group } from "./interfaces";

//  requestJson: any,
// groupname: any,
// user: string,
// group: Group | undefined,
// conn: SocketStream,
// serverID: string,
// serverList: Map<string, WebSocket>,
// groups: Map<string, Group>,
// conns: Map<SocketStream, ConnectionObject>,
// messageQueue: Map<string, any>

export function rec_sendMessage(
  requestJson: any,
  group: Group | undefined,
  groupname: any,
  conn: SocketStream,
  serverID: string,
  serverList: Map<string, WebSocket>,
  conns: Map<SocketStream, ConnectionObject>,
  messageQueue: Map<string, any>
) {
  const newMsg = requestJson;

  if (group) {
    console.log("New Message received in Group:", groupname);
    newMsg.operation = ChatOperations.NEW_MESSAGE;

    group.conns.forEach((conn) => {
      conn.socket.send(JSON.stringify(newMsg));
      messageQueue.set(conns.get(conn)!.id + "_" + newMsg.payload.timestamp, {
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
          fromServer: serverID,
        },
      })
    );
  }

  if (!newMsg.serverID) {
    newMsg.serverID = serverID;

    serverList.forEach((value, key) => {
      messageQueue.set(key + "_" + newMsg.payload.timestamp, {
        conn,
        newMsg,
      });

      value.send(JSON.stringify(newMsg));
    });
  }
}

export function rec_createOrJoinGroup(
  group: Group | undefined,
  groupname: any,
  user: string,
  conn: SocketStream,
  serverList: Map<string, WebSocket>,
  groups: Map<string, Group>,
  conns: Map<SocketStream, ConnectionObject>
) {
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
  } else if (conns.has(conn)) {
    disconnect(conn, conns, groups, serverList);
  }

  group.users.add(user);
  group.conns.add(conn);

  conns.set(conn, { id: uuidv4(), groupname, user });
  groups.set(groupname, group);

  serverList.forEach((socket: WebSocket) => {
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

export function rec_serverGroupJoin(
  group: Group | undefined,
  groupname: any,
  user: string,
  groups: Map<string, Group>
) {
  if (!group) {
    console.log("Group:", groupname, "does not exist locally. Creating");
    group = { users: new Set(), conns: new Set() };
    groups.set(groupname, group);
  }
  group.users.add(user);
}

export function rec_serverGroupLeft(group: Group | undefined, user: string) {
  if (group) {
    group.users.delete(user);
  }
}
export function rec_ackMessage(
  id: string,
  messageQueue: Map<string, any>,
  serverID: string
) {
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
    const payload = currQueueItem.newMsg.payload;
    payload.serverID = serverID;
    currQueueItem.conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.placeholder,
        payload,
      })
    );
  }
}

export function rec_serverRegister(
  requestJson: any,
  conn: SocketStream,
  serverID: string
) {
  if (requestJson.payload!["serverID"] == serverID) {
    conn.socket.send(
      JSON.stringify({
        operation: ChatOperations.SERVER_REQUESTED_SELF_REGISTER,
      })
    );
  }
  conn.socket.send(
    JSON.stringify({
      operation: ChatOperations.SERVER_REGISTERED,
      payload: { SERVER_ID: serverID },
    })
  );
}

export function disconnect(
  conn: SocketStream,
  conns: Map<SocketStream, ConnectionObject>,
  groups: Map<string, Group>,
  serverList: Map<string, WebSocket>
) {
  const userInfo = conns.get(conn)!;
  if (userInfo) {
    const oldGroup = groups.get(userInfo.groupname);

    oldGroup!.users.delete(userInfo.user);
    oldGroup!.conns.delete(conn);
    conns.delete(conn);
    serverList.forEach((socket: WebSocket) => {
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

export function connectServers(
  serverID: string,
  serverList: Map<string, WebSocket>,
  messageQueue: Map<string, any>
): NodeJS.Timeout[] {
  const timers = [];
  for (const host of process.env.DB_HOSTLIST!.split(",")) {
    const currentTimer = setTimeout(() => {
      const currSocket = new WebSocket(host + "/socket");

      const reconnect = (_: any) => {
        serverList.forEach((socket: WebSocket, key: string) => {
          if (socket == currSocket) {
            serverList.delete(key);
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
            payload: { serverID: serverID },
          })
        );
      };

      currSocket.onmessage = (msg) => {
        const message = JSON.parse(msg.data.toString());
        if (message.operation == ChatOperations.placeholder) {
          rec_ackMessage(
            serverID + "_" + message.payload.timestamp,
            messageQueue,
            serverID
          );
        } else if (
          message.operation == ChatOperations.SERVER_REQUESTED_SELF_REGISTER
        ) {
          console.log(
            "Unregistering own server from serverlist:",
            currSocket.url
          );
          clearTimeout(currentTimer);
          currSocket.onclose = null;
          currSocket.close();
        } else if ((message.operation = ChatOperations.SERVER_REGISTERED)) {
          serverList.set(message.payload.serverID, currSocket);
          console.log("Registered server:", currSocket.url);
        }
      };
    }, 1000);
    timers.push(currentTimer);
    return timers;
  }
}
