import { config as loadEnv } from "dotenv";
import build from "./app";

loadEnv();
const { BACKEND_HOST, BACKEND_PORT } = process.env;

const portInput = process.argv[2];
const port = portInput ? Number(portInput) : Number(BACKEND_PORT);

const app = build({
  logger: true,
});

app.listen({ host: BACKEND_HOST, port }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
