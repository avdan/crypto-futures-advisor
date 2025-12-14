import cors from "@fastify/cors";
import Fastify from "fastify";

import { healthRoutes } from "./routes/health.js";
import { futuresRoutes } from "./routes/futures.js";
import { futuresAnalysisRoutes } from "./routes/futuresAnalysis.js";
import { watchlistRoutes } from "./routes/watchlist.js";
import { scannerRoutes } from "./routes/scanner.js";
import { orderPlanRoutes } from "./routes/orderPlan.js";
import { alertsRoutes } from "./routes/alerts.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { exportRoutes } from "./routes/export.js";

function parseCorsOrigin(raw: string | undefined): true | string[] {
  if (!raw) return true;

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : true;
}

export async function buildApp() {
  const app = Fastify({ logger: { level: "warn" } });

  await app.register(cors, {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true
  });

  await app.register(healthRoutes);
  await app.register(futuresRoutes);
  await app.register(futuresAnalysisRoutes);
  await app.register(orderPlanRoutes);
  await app.register(watchlistRoutes);
  await app.register(scannerRoutes);
  await app.register(alertsRoutes);
  await app.register(notificationsRoutes);
  await app.register(exportRoutes);

  app.get("/", async () => ({ service: "binance-advisor-api" }));

  return app;
}
