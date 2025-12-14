import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

import { buildApp } from "./app.js";

function loadEnv() {
  const cwd = process.cwd();

  const candidates = [
    path.join(cwd, ".env"),
    path.join(cwd, "apps", "api", ".env")
  ];

  const envPath = candidates.find((p) => fs.existsSync(p));
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }
}

loadEnv();

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error({ err }, "Failed to start server");
  process.exit(1);
}
