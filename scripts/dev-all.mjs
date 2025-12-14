import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function loadEnvFile(filePath) {
  try {
    const abs = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(abs)) return {};

    const text = fs.readFileSync(abs, "utf8");
    /** @type {Record<string, string>} */
    const env = {};

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const idx = line.indexOf("=");
      if (idx === -1) continue;

      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.on("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1" }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(preferredPort, maxTries = 25) {
  for (let i = 0; i < maxTries; i += 1) {
    const port = preferredPort + i;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found starting at ${preferredPort}`);
}

function start(label, args, options = {}) {
  const child = spawn(npmCmd, args, {
    stdio: "inherit",
    env: process.env,
    ...options
  });

  child.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[dev:all] failed to start ${label}:`, err);
  });

  return child;
}

const apiEnv = loadEnvFile("apps/api/.env");
const webEnv = loadEnvFile("apps/web/.env");

const requestedApiPort = Number(process.env.API_PORT ?? apiEnv.PORT ?? 3001);
const requestedWebPort = Number(process.env.WEB_PORT ?? 5173);

const apiPort = await pickPort(Number.isFinite(requestedApiPort) ? requestedApiPort : 3001);
const webPort = await pickPort(Number.isFinite(requestedWebPort) ? requestedWebPort : 5173);

// eslint-disable-next-line no-console
console.log(`[dev:all] API port: ${apiPort} (requested ${requestedApiPort})`);
// eslint-disable-next-line no-console
console.log(`[dev:all] Web port: ${webPort} (requested ${requestedWebPort})`);

const corsOrigin = `http://localhost:${webPort}`;
const apiBaseUrl = `http://localhost:${apiPort}`;

const api = start("api", ["-w", "apps/api", "run", "dev"], {
  stdio: "inherit",
  env: {
    ...apiEnv,
    ...process.env,
    PORT: String(apiPort),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? corsOrigin
  }
});

const web = start("web", ["-w", "apps/web", "run", "dev", "--", "--port", String(webPort)], {
  stdio: "inherit",
  env: {
    ...webEnv,
    ...process.env,
    VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? apiBaseUrl
  }
});

const children = [api, web];

function shutdown(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

let exiting = false;
function onExit(code = 0) {
  if (exiting) return;
  exiting = true;
  shutdown("SIGTERM");
  process.exit(code);
}

process.on("SIGINT", () => onExit(0));
process.on("SIGTERM", () => onExit(0));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (signal) {
      // eslint-disable-next-line no-console
      console.error(`[dev:all] ${child.pid} exited with signal ${signal}`);
      onExit(1);
      return;
    }
    onExit(code ?? 0);
  });
}
