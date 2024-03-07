import * as FastifyWebSocket from "@fastify/websocket";
import Fastify from "fastify";

const server = Fastify({ logger: true });
server.register(FastifyWebSocket);

const active_groups = new Map();
active_groups.set("Test", {
  users: ["testUser"],
  messages: [{ user: "testUser", msg: "Hello World" }],
  connections: [],
});

server.register(async function (server) {
  server.get("/", { websocket: true }, (connection) => {
    // Client has been connected. Send active groups to client.
    connection.socket.send(JSON.stringify(Array.from(active_groups.keys())));

    connection.socket.on("message", (request) => {
      //Pars stringified JSON
      const requestJson = JSON.parse(request);
      const groupname = requestJson.payload.groupname;
      const user = requestJson.payload.user;

      let response = {};

      switch (requestJson.operation) {
        case "CREATE_OR_JOIN_GROUP":
          if (!active_groups.has(groupname)) {
            active_groups.set(groupname, {
              users: [user],
              messages: [],
              connections: [connection],
            });
            response = {
              operation: "GROUP_CREATED",
            };
          } else {
            const group = active_groups.get(groupname);
            if (group.users.includes(user)) {
              console.log("User: " + user + " is already in group");
              response = {
                operation: "NAME_ALREADY_TAKEN_FOR_GROUP",
              };
            } else {
              group.users.push(user);
              group.connections.push(connection);

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

          for (const conn of group.connections) {
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
  });
});

server.listen({ port: 5000 }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
