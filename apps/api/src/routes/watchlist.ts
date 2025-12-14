import type { FastifyPluginAsync } from "fastify";
import type { ApiErrorResponse, UpdateWatchlistRequest, Watchlist } from "@binance-advisor/shared";

import { createWatchlistStore } from "../services/watchlist/store.js";

function badRequest(message: string): ApiErrorResponse {
  return { error: { code: "BAD_REQUEST", message } };
}

export const watchlistRoutes: FastifyPluginAsync = async (app) => {
  const store = createWatchlistStore();

  app.get("/watchlist", async () => {
    return await store.get();
  });

  app.put("/watchlist", async (req, reply) => {
    const body = (req.body ?? {}) as Partial<UpdateWatchlistRequest>;
    if (!Array.isArray(body.symbols)) {
      return reply.code(400).send(badRequest("Body.symbols must be an array of symbols."));
    }

    try {
      const watchlist: Watchlist = await store.set(body.symbols);
      return watchlist;
    } catch (err) {
      return reply
        .code(400)
        .send(badRequest(err instanceof Error ? err.message : "Invalid watchlist"));
    }
  });
};

