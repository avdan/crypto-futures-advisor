import type { FastifyPluginAsync } from "fastify";
import type { AlertsResponse } from "@binance-advisor/shared";

import { createAlertStore } from "../services/alerts/store.js";

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  const store = createAlertStore();

  app.get("/export/alerts.json", async () => {
    const alerts = await store.list({ limit: 50_000, includeAcknowledged: true });
    const body: AlertsResponse = {
      fetchedAt: new Date().toISOString(),
      alerts
    };
    return body;
  });

  app.get("/export/alerts.csv", async (req, reply) => {
    const alerts = await store.list({ limit: 50_000, includeAcknowledged: true });

    const header = [
      "id",
      "createdAt",
      "acknowledgedAt",
      "type",
      "severity",
      "symbol",
      "title",
      "message",
      "dedupeKey"
    ].join(",");

    const lines = alerts.map((a) =>
      [
        a.id,
        a.createdAt,
        a.acknowledgedAt ?? "",
        a.type,
        a.severity,
        a.symbol ?? "",
        a.title,
        a.message,
        a.dedupeKey
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [header, ...lines].join("\n");
    reply.header("content-type", "text/csv; charset=utf-8");
    return csv;
  });
};

