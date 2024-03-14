import * as FastifyStatic from "@fastify/static";
import * as FastifyWebSocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";

import { SocketStream } from "@fastify/websocket";

import { ConstantBackoff, handleAll, retry } from "cockatiel";
import { Etcd3, GRPCUnavailableError } from "etcd3";

class Database {
  private myClient: Etcd3 | Map<string, string>;

  public constructor(_: { hostList: string[] }) {
    console.log("Trying to connect to etcd");
    this.myClient = new Etcd3({
      hosts: hostList,
      faultHandling: {
        global: retry(handleAll, {
          backoff: new ConstantBackoff(1000),
          maxAttempts: 3,
        }),
      },
    });
  }

  private initMap(): Map<string, string> {
    console.log("Error while trying to put value to etcd");
    console.log("Trying to put value to Map");
    return new Map();
  }

  public put(key: string) {
    return {
      value: (value: string) => {
        return {
          exec: () => {
            if (this.myClient instanceof Map) {
              this.myClient.set(key, value);
              return Promise.resolve(true);
            }

            this.myClient
              .put(key)
              .value(value)
              .exec()
              .then(
                (value) => true,
                (rej) => {
                  if (rej instanceof GRPCUnavailableError) {
                    this.myClient = this.initMap();
                    this.myClient.set(key, value);
                    return true;
                  }
                  console.log(rej);
                  return false;
                }
              );
          },
        };
      },
    };
  }

  public get(key: string) {
    return {
      json: () => {
        if (this.myClient instanceof Map) {
          const data = this.myClient.get(key);
          return data
            ? Promise.resolve(JSON.parse(data))
            : Promise.resolve(null);
        }

        return this.myClient
          .get(key)
          .json()
          .then(
            (value) => (value ? value : null),
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.myClient = this.initMap();
                return this.myClient.get(key);
              }
              console.log(rej);
              return null;
            }
          );
      },
    };
  }

  public getAll() {
    return {
      keys: () => {
        if (this.myClient instanceof Map) {
          return Promise.resolve(Array.from(this.myClient.keys()));
        }

        return this.myClient
          .getAll()
          .keys()
          .then(
            (keys) => keys,
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.myClient = this.initMap();
                return Promise.resolve(Array.from(this.myClient.keys()));
              }
              console.log(rej);
              return [];
            }
          );
      },
    };
  }

  public delete(
    key?: string
  ): Promise<boolean> | { all: () => Promise<boolean> } {
    if (key != undefined && key != null && key != "") {
      if (this.myClient instanceof Map) {
        return Promise.resolve(this.myClient.delete(key));
      }
      return this.myClient
        .delete()
        .key(key)
        .then(
          (value) => Number(value.deleted) > 0,
          (rej) => {
            if (rej instanceof GRPCUnavailableError) {
              this.myClient = this.initMap();
              return this.myClient.delete(key);
            }
            console.log(rej);
            return false;
          }
        );
    }
    return {
      all: () => {
        if (this.myClient instanceof Map) {
          this.myClient.clear();
          return Promise.resolve(true);
        }
        return this.myClient
          .delete()
          .all()
          .exec()
          .then(
            (value) => Number(value.deleted) > 0,
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.myClient = this.initMap();
                return true;
              }
              console.log(rej);
              return false;
            }
          );
      },
    };
  }
}

interface Group {
  messages: string[];
  users: string[];
}

interface Message {
  operation: string;
  payload?: { groupname: string; user: string; msg: string };
}

const hostList: string[] = [
  "http://localhost:2309",
  "http://localhost:2319",
  "http://localhost:2329",
];

const dbClient = new Database({
  hostList: hostList,
});

const server: FastifyInstance = Fastify({ logger: true });
server.register(FastifyWebSocket);

server.register(FastifyStatic, {
  root: "/home/fabian/workspaces/node_projects/giggle-grove/backend",
});

const connections: Map<string, SocketStream> = new Map();

server.register(async function (server: FastifyInstance) {
  server.get("/chat", async (_request, _reply) => {
    return _reply.sendFile("index.html");
  });

  server.get("/groups", async (_request, _reply) => {
    return dbClient.getAll().keys();
  });

  server.delete("/groups", async (_request, _reply) => {
    return (dbClient.delete() as any).all();
  });

  server.get("/", { websocket: true }, (connection: SocketStream) => {
    // Client has been connected. Send active groups to client.

    connection.socket.on("message", async (request) => {
      //Parse stringified JSON
      const requestJson: Message = JSON.parse(request.toString());
      const groupname = requestJson.payload!.groupname;
      const user = requestJson.payload!.user;

      let group: Group;
      let response = {};

      switch (requestJson.operation) {
        case "CREATE_OR_JOIN_GROUP":
          group = (await dbClient.get(groupname).json()) as Group;

          if (!group) {
            group = {
              messages: [],
              users: [],
            };
          }

          if (group.users.includes(user)) {
            console.log("User: " + user + " is already in group");
            response = {
              operation: "NAME_ALREADY_TAKEN_FOR_GROUP",
            };
            connection.socket.send(JSON.stringify(response));
            break;
          }

          group.users.push(user);

          const connectionKey = groupname + "_" + user;

          connections.set(connectionKey, connection);

          dbClient.put(groupname).value(JSON.stringify(group)).exec();

          response = {
            operation: "GROUP_JOINED",
          };

          console.log("User " + user + " joined group ", group);

          connection.socket.send(JSON.stringify(response));
          break;

        case "SEND_MESSAGE":
          group = (await dbClient.get(groupname).json()) as Group;

          if (group) {
            const newMsg = requestJson.payload!.msg;

            console.log(
              "New Message received in Group: " + groupname + " Msg: " + newMsg
            );

            group.messages.push(newMsg);

            connections.forEach((value: SocketStream, key: string) => {
              if (key.startsWith(groupname)) {
                value.socket.send(
                  JSON.stringify({
                    operation: "NEW_MESSAGE",
                    payload: { user, msg: newMsg },
                  })
                );
              }
            });
          }
          break;
      }
    });

    connection.socket.on("close", () => {
      console.log("Client has been disconnected");
      for (const [key, value] of connections) {
        if (value === connection) {
          const valueSplit = key.split("_");
          const groupname = valueSplit[0];
          const userOfCon = valueSplit[1];

          console.log(
            "User: " +
              userOfCon +
              " in Group: " +
              groupname +
              " has been disconnected"
          );

          connections.delete(key);

          dbClient
            .get(groupname)
            .json()
            .then((group) => {
              if (group) {
                group["users"] = group["users"].filter(
                  (user: string) => user !== userOfCon
                );
                dbClient.put(groupname).value(JSON.stringify(group)).exec();
              }
            });

          break;
        }
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
