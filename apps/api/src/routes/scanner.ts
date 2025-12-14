import type { FastifyPluginAsync } from "fastify";
import type { ApiErrorResponse } from "@binance-advisor/shared";

import { createWatchlistStore } from "../services/watchlist/store.js";
import { createScannerService } from "../services/scanner/scannerService.js";

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

export const scannerRoutes: FastifyPluginAsync = async (app) => {
  const watchlistStore = createWatchlistStore();
  const scanner = createScannerService({ watchlistStore, logger: app.log });

  scanner.start();

  app.get("/scanner/status", async () => scanner.getStatus());

  app.get("/scanner/results", async (req, reply) => {
    const latest = scanner.getLatest();
    if (!latest) {
      return reply
        .code(404)
        .send(errorResponse("NO_RESULTS", "No scan results yet. Run POST /scanner/run."));
    }
    return latest;
  });

  app.post("/scanner/run", async (req, reply) => {
    try {
      const res = await scanner.runNow();
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to run scanner";
      const code = message.includes("already running") ? 409 : 500;
      return reply.code(code).send(errorResponse("SCANNER_ERROR", message));
    }
  });
};

