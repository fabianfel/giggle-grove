import * as FastifyStatic from "@fastify/static";
import * as FastifyWebSocket from "@fastify/websocket";
import Fastify, { FastifyInstance } from "fastify";

import { SocketStream } from "@fastify/websocket";

import { ConstantBackoff, handleAll, retry } from "cockatiel";
import { config as loadEnv } from "dotenv";
import { Etcd3, GRPCUnavailableError } from "etcd3";

class Database {
  private usedClient: Etcd3 | Map<string, string>;
  private dbClient: Etcd3;

  public constructor(options: { hostList: string[] }) {
    console.log("Trying to connect to etcd");
    this.dbClient = new Etcd3({
      hosts: options.hostList,
      faultHandling: {
        global: retry(handleAll, {
          backoff: new ConstantBackoff(1000),
          maxAttempts: 3,
        }),
      },
    });
    this.usedClient = this.dbClient;
  }

  private reconnectTimer: NodeJS.Timeout;

  private initMap(): Map<string, string> {
    console.log("Error while trying to put value to etcd");
    console.log("Trying to put value to Map");
    this.reconnectTimer = setTimeout(async () => {
      this.dbClient
        .getAll()
        .keys()
        .then(() => (this.usedClient = this.dbClient))
        .catch(() => {
          console.log(
            "Retry to connect to etcd failed. Trying again in 5 seconds."
          );
          this.reconnectTimer.refresh();
        });
    }, 5000);
    return new Map();
  }

  public put(key: string) {
    return {
      value: (value: string) => {
        return {
          exec: () => {
            if (this.usedClient instanceof Map) {
              this.usedClient.set(key, value);
              return Promise.resolve(true);
            }

            this.usedClient
              .put(key)
              .value(value)
              .exec()
              .then(
                (value) => true,
                (rej) => {
                  if (rej instanceof GRPCUnavailableError) {
                    this.usedClient = this.initMap();
                    this.usedClient.set(key, value);
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
        if (this.usedClient instanceof Map) {
          const data = this.usedClient.get(key);
          return data
            ? Promise.resolve(JSON.parse(data))
            : Promise.resolve(null);
        }

        return this.usedClient
          .get(key)
          .json()
          .then(
            (value) => (value ? value : null),
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.usedClient = this.initMap();
                return this.usedClient.get(key);
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
        if (this.usedClient instanceof Map) {
          return Promise.resolve(Array.from(this.usedClient.keys()));
        }

        return this.usedClient
          .getAll()
          .keys()
          .then(
            (keys) => keys,
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.usedClient = this.initMap();
                return Promise.resolve(Array.from(this.usedClient.keys()));
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
      if (this.usedClient instanceof Map) {
        return Promise.resolve(this.usedClient.delete(key));
      }
      return this.usedClient
        .delete()
        .key(key)
        .then(
          (value) => Number(value.deleted) > 0,
          (rej) => {
            if (rej instanceof GRPCUnavailableError) {
              this.usedClient = this.initMap();
              return this.usedClient.delete(key);
            }
            console.log(rej);
            return false;
          }
        );
    }
    return {
      all: () => {
        if (this.usedClient instanceof Map) {
          this.usedClient.clear();
          return Promise.resolve(true);
        }
        return this.usedClient
          .delete()
          .all()
          .exec()
          .then(
            (value) => Number(value.deleted) > 0,
            (rej) => {
              if (rej instanceof GRPCUnavailableError) {
                this.usedClient = this.initMap();
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

loadEnv();

const dbClient = new Database({
  hostList: process.env.DB_HOSTLIST!.split(","),
});

const server: FastifyInstance = Fastify({ logger: true });
server.register(FastifyWebSocket);

server.register(FastifyStatic, {
  root: process.cwd() + "/public",
});

const connections: Map<string, SocketStream> = new Map();

server.register(async function (server: FastifyInstance) {
  server.get("/", async (_request, _reply) => {
    return _reply.sendFile("./index.html");
  });

  server.get("/groups", async (_request, _reply) => {
    return dbClient.getAll().keys();
  });

  server.delete("/groups", async (_request, _reply) => {
    return (dbClient.delete() as any).all();
  });

  server.get("/socket", { websocket: true }, (connection: SocketStream) => {
    // Client has been connected. Send active groups to client.

    connection.socket.on("message", async (request) => {
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

const { BACKEND_HOST, BACKEND_PORT } = process.env;

server.listen({ host: BACKEND_HOST, port: Number(BACKEND_PORT) }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
