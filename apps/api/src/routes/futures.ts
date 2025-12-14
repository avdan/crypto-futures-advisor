import type { FastifyPluginAsync } from "fastify";
import type {
  ApiErrorResponse,
  FuturesOpenOrdersResponse,
  FuturesPositionsResponse
} from "@binance-advisor/shared";

import { BinanceHttpError } from "../services/binance/errors.js";
import {
  createFuturesClient,
  fetchFuturesAccountInfo,
  fetchFuturesOpenOrders,
  fetchFuturesPositionRisk
} from "../services/binance/futures.js";

export const futuresRoutes: FastifyPluginAsync = async (app) => {
  app.get("/futures/positions", async (req, reply) => {
    const client = createFuturesClient();

    if (!client) {
      const body: ApiErrorResponse = {
        error: {
          code: "BINANCE_NOT_CONFIGURED",
          message:
            "Set BINANCE_API_KEY and BINANCE_API_SECRET in apps/api/.env to enable Binance Futures endpoints."
        }
      };
      return reply.code(503).send(body);
    }

    try {
      const [rows, accountInfo] = await Promise.all([
        fetchFuturesPositionRisk(client),
        fetchFuturesAccountInfo(client)
      ]);

      const nonZeroOnly = (req.query as { nonZero?: string } | undefined)?.nonZero;
      const filteredRows =
        nonZeroOnly === "true" ? rows.filter((p) => p.amount !== 0) : rows;

      // Calculate actual leverage for cross margin positions
      const walletEquity = accountInfo.walletEquity;
      const positions = filteredRows.map((p) => {
        if (p.marginType === "cross" && walletEquity > 0 && p.actualLeverage === null) {
          return {
            ...p,
            actualLeverage: Math.abs(p.notional) / walletEquity
          };
        }
        return p;
      });

      const body: FuturesPositionsResponse = {
        fetchedAt: new Date().toISOString(),
        positions
      };

      return body;
    } catch (err) {
      if (err instanceof BinanceHttpError) {
        app.log.warn(
          { status: err.status, code: err.code },
          "Binance Futures positions request failed"
        );
      }

      const body: ApiErrorResponse = {
        error: {
          code: "BINANCE_UPSTREAM_ERROR",
          message: err instanceof Error ? err.message : "Unknown error"
        }
      };
      return reply.code(502).send(body);
    }
  });

  app.get("/futures/open-orders", async (req, reply) => {
    const client = createFuturesClient();

    if (!client) {
      const body: ApiErrorResponse = {
        error: {
          code: "BINANCE_NOT_CONFIGURED",
          message:
            "Set BINANCE_API_KEY and BINANCE_API_SECRET in apps/api/.env to enable Binance Futures endpoints."
        }
      };
      return reply.code(503).send(body);
    }

    const symbol = (req.query as { symbol?: string } | undefined)?.symbol;

    try {
      const orders = await fetchFuturesOpenOrders(client, symbol);
      const body: FuturesOpenOrdersResponse = {
        fetchedAt: new Date().toISOString(),
        orders
      };
      return body;
    } catch (err) {
      if (err instanceof BinanceHttpError) {
        app.log.warn(
          { status: err.status, code: err.code },
          "Binance Futures open orders request failed"
        );
      }

      const body: ApiErrorResponse = {
        error: {
          code: "BINANCE_UPSTREAM_ERROR",
          message: err instanceof Error ? err.message : "Unknown error"
        }
      };
      return reply.code(502).send(body);
    }
  });
};

