import t from "tap";
import build from "../src/app";
// import { ChatOperations } from "../src/chatOperations";

// let app;
// let ws;

// test("routes correctly the message", async (t) => {
//   t.plan(1);
//   app = build();

//   ws = await app.injectWS("/socket");

//   ws.send(
//     JSON.stringify({
//       operation: ChatOperations.CREATE_OR_JOIN_GROUP,
//       payload: { groupname: "test", user: "user" },
//     })
//   );

//   ws.onmessage = (event) => {
//     console.log(event.data);
//     ws.close();
//     app.close();

//     t.equal(
//       event.data,
//       JSON.stringify({ operation: ChatOperations.GROUP_JOINED })
//     );
//     //   t.end();
//   };
// });

t.test("this is a child test", (t) => {
  const { app, disconnectServers } = build();

  t.teardown(() => {
    disconnectServers();
    app.close();
    t.end();
  });

  t.pass("this passes");

  // disconnectServers();
  // app.ready().then(() => {
  //   t.pass("app is ready");
  // });
  // call this when you're done
  // t.end();
});
