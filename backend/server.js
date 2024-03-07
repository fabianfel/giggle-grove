import * as FastifyWebSocket from "@fastify/websocket";
import Fastify from "fastify";

const server = Fastify({ logger: true });
server.register(FastifyWebSocket);

const active_groups = new Map();
active_groups.set("Test", {
  messages: [{ user: "testUser", msg: "Hello World" }],
  connections: new Map(),
});

server.register(async function (server) {
  server.get("/groups", async (request, reply) => {
    return Array.from(active_groups.keys());
  });
  server.get("/", { websocket: true }, (connection) => {
    // Client has been connected. Send active groups to client.

    connection.socket.on("message", (request) => {
      //Pars stringified JSON
      const requestJson = JSON.parse(request);
      const groupname = requestJson.payload.groupname;
      const user = requestJson.payload.user;

      let response = {};

      switch (requestJson.operation) {
        case "CREATE_OR_JOIN_GROUP":
          if (!active_groups.has(groupname)) {
            const connectionMap = new Map();
            connectionMap.set(connection, user);

            active_groups.set(groupname, {
              messages: [],
              connections: connectionMap,
            });
            response = {
              operation: "GROUP_CREATED",
            };
          } else {
            const group = active_groups.get(groupname);
            if (Array.from(group.connections.values()).includes(user)) {
              console.log("User: " + user + " is already in group");
              response = {
                operation: "NAME_ALREADY_TAKEN_FOR_GROUP",
              };
            } else {
              group.connections.set(connection, user);
              response = {
                operation: "GROUP_JOINED",
              };
            }
          }
          connection.socket.send(JSON.stringify(response));
          break;

        case "SEND_MESSAGE":
          const group = active_groups.get(requestJson.payload.groupname);
          const new_msg = requestJson.payload.msg;

          console.log(
            "New Message received in Group: " + groupname + " Msg: " + new_msg
          );

          group.messages.push(new_msg);

          for (const conn of group.connections.keys()) {
            conn.socket.send(
              JSON.stringify({
                operation: "NEW_MESSAGE",
                payload: { user, msg: new_msg },
              })
            );
          }
          break;
      }
    });

    connection.socket.on("close", () => {
      console.log("Client has been disconnected");
      for (const group of active_groups.values()) {
        group.connections.delete(connection);
      }
    });
  });
});

server.listen({ port: 5000 }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
