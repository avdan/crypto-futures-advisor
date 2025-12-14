import type { FastifyPluginAsync } from "fastify";
import type { AckAlertResponse, AlertsResponse, ApiErrorResponse } from "@binance-advisor/shared";

import { createAlertStore } from "../services/alerts/store.js";
import { createAlertsMonitor } from "../services/alerts/monitor.js";

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

function parseBool(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(n, 2000));
}

export const alertsRoutes: FastifyPluginAsync = async (app) => {
  const store = createAlertStore();
  const monitor = createAlertsMonitor({ store, logger: app.log });
  monitor.start();

  app.addHook("onClose", async () => {
    monitor.stop();
  });

  app.get("/alerts", async (req) => {
    const query = (req.query ?? {}) as { limit?: string; includeAcknowledged?: string };
    const alerts = await store.list({
      limit: parseLimit(query.limit, 200),
      includeAcknowledged: parseBool(query.includeAcknowledged)
    });

    const body: AlertsResponse = {
      fetchedAt: new Date().toISOString(),
      alerts
    };

    return body;
  });

  app.post("/alerts/:id/ack", async (req, reply) => {
    const id = (req.params as { id?: string } | undefined)?.id?.trim();
    if (!id) {
      return reply.code(400).send(errorResponse("BAD_REQUEST", "Alert id is required."));
    }

    const alert = await store.acknowledge(id);
    if (!alert) {
      return reply.code(404).send(errorResponse("NOT_FOUND", "Alert not found."));
    }

    const body: AckAlertResponse = {
      updatedAt: new Date().toISOString(),
      alert
    };

    return body;
  });
};
