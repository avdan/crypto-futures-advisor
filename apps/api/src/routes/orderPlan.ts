import type { FastifyPluginAsync } from "fastify";
import type { ApiErrorResponse, CreateOrderPlanDraftRequest, CreateOrderPlanDraftResponse } from "@binance-advisor/shared";

import { buildOrderPlanDraft } from "../domain/orderPlan/buildDraft.js";
import { BinanceHttpError } from "../services/binance/errors.js";
import { createFuturesClient, fetchFuturesOpenOrders, fetchFuturesPositionRisk } from "../services/binance/futures.js";

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase();
  if (!symbol) return null;
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) return null;
  return symbol;
}

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

export const orderPlanRoutes: FastifyPluginAsync = async (app) => {
  app.post("/futures/order-plan/draft", async (req, reply) => {
    const body = (req.body ?? {}) as Partial<CreateOrderPlanDraftRequest>;
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return reply.code(400).send(errorResponse("BAD_REQUEST", "Body.symbol is required."));
    }
    if (!Array.isArray(body.selections)) {
      return reply.code(400).send(errorResponse("BAD_REQUEST", "Body.selections must be an array."));
    }

    const client = createFuturesClient();
    if (!client) {
      return reply
        .code(503)
        .send(errorResponse("BINANCE_NOT_CONFIGURED", "Binance is not configured on the server."));
    }

    try {
      const positions = await fetchFuturesPositionRisk(client);
      const position = positions.find((p) => p.symbol === symbol && p.amount !== 0) ?? null;
      const openOrders = await fetchFuturesOpenOrders(client, symbol);

      const { steps, warnings } = buildOrderPlanDraft({
        request: {
          symbol,
          selections: body.selections as CreateOrderPlanDraftRequest["selections"]
        },
        position,
        openOrders
      });

      const res: CreateOrderPlanDraftResponse = {
        createdAt: new Date().toISOString(),
        symbol,
        steps,
        warnings
      };

      return res;
    } catch (err) {
      if (err instanceof BinanceHttpError) {
        app.log.warn({ status: err.status, code: err.code }, "Binance upstream error");
      }
      return reply
        .code(502)
        .send(errorResponse("BINANCE_UPSTREAM_ERROR", err instanceof Error ? err.message : "Unknown error"));
    }
  });
};

