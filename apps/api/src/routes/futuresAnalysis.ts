import type { FastifyPluginAsync } from "fastify";
import type {
  ApiErrorResponse,
  FuturesKlineInterval,
  FuturesPositionAnalysisRequest,
  FuturesPositionAnalysisResponse
} from "@binance-advisor/shared";

import { getDefaultKlineInterval, getKlineLimit, getRiskConstraints } from "../config.js";
import { atr, rsi, sma } from "../domain/indicators/candles.js";
import {
  computeDeterministicNotes,
  computeSuggestedStopFromAtr,
  computeTakeProfitFromTargetRoi,
  positionDirection
} from "../domain/risk/positionPlan.js";
import { BinanceHttpError } from "../services/binance/errors.js";
import {
  createFuturesClient,
  fetchFuturesOpenOrders,
  fetchFuturesPositionRisk
} from "../services/binance/futures.js";
import { fetchFuturesKlines } from "../services/binance/publicFutures.js";
import { runAdvisorProviders } from "../services/llm/aggregate.js";

const ALLOWED_INTERVALS: FuturesKlineInterval[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d"
];

function isAllowedInterval(value: unknown): value is FuturesKlineInterval {
  return typeof value === "string" && (ALLOWED_INTERVALS as string[]).includes(value);
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase();
  if (!symbol) return null;
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) return null;
  return symbol;
}

function badRequest(message: string): ApiErrorResponse {
  return { error: { code: "BAD_REQUEST", message } };
}

export const futuresAnalysisRoutes: FastifyPluginAsync = async (app) => {
  app.post("/futures/analysis/position", async (req, reply) => {
    const body = (req.body ?? {}) as Partial<FuturesPositionAnalysisRequest>;

    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return reply.code(400).send(badRequest("Body.symbol is required (e.g. BTCUSDT)."));
    }

    const defaultIntervalRaw = getDefaultKlineInterval();
    const defaultInterval: FuturesKlineInterval =
      isAllowedInterval(defaultIntervalRaw) ? defaultIntervalRaw : "1h";

    if (body.interval !== undefined && !isAllowedInterval(body.interval)) {
      return reply
        .code(400)
        .send(badRequest(`Body.interval must be one of: ${ALLOWED_INTERVALS.join(", ")}`));
    }

    const interval = body.interval ?? defaultInterval;
    const constraints = getRiskConstraints();

    const client = createFuturesClient();
    if (!client) {
      const response: FuturesPositionAnalysisResponse = {
        fetchedAt: new Date().toISOString(),
        symbol,
        constraints,
        position: null,
        openOrders: [],
        indicators: null,
        deterministic: {
          suggestedStopLoss: null,
          suggestedTakeProfit: null,
          warnings: ["Binance is not configured on the server."],
          notes: []
        },
        llm: {
          providers: await runAdvisorProviders({
            symbol,
            constraints,
            position: null,
            openOrders: [],
            indicators: null
          })
        }
      };

      return reply.code(503).send(response);
    }

    let position = null as FuturesPositionAnalysisResponse["position"];
    let openOrders: FuturesPositionAnalysisResponse["openOrders"] = [];

    try {
      const rows = await fetchFuturesPositionRisk(client);
      position = rows.find((p) => p.symbol === symbol && p.amount !== 0) ?? null;
      openOrders = await fetchFuturesOpenOrders(client, symbol);
    } catch (err) {
      if (err instanceof BinanceHttpError) {
        app.log.warn({ status: err.status, code: err.code }, "Binance upstream error");
      }

      const response: FuturesPositionAnalysisResponse = {
        fetchedAt: new Date().toISOString(),
        symbol,
        constraints,
        position: null,
        openOrders: [],
        indicators: null,
        deterministic: {
          suggestedStopLoss: null,
          suggestedTakeProfit: null,
          warnings: ["Failed to fetch Binance position/order data."],
          notes: [err instanceof Error ? err.message : "Unknown error"]
        },
        llm: {
          providers: await runAdvisorProviders({
            symbol,
            constraints,
            position: null,
            openOrders: [],
            indicators: null
          })
        }
      };

      return reply.code(502).send(response);
    }

    let indicators: FuturesPositionAnalysisResponse["indicators"] = null;
    try {
      const candles = await fetchFuturesKlines({
        symbol,
        interval,
        limit: getKlineLimit()
      });
      const closes = candles.map((c) => c.close);
      indicators = {
        interval,
        lastClose: closes.at(-1) ?? null,
        atr14: atr(candles, 14),
        rsi14: rsi(candles, 14),
        sma20: sma(closes, 20),
        sma50: sma(closes, 50)
      };
    } catch (err) {
      app.log.info({ err }, "Unable to fetch klines/indicators");
      indicators = null;
    }

    const warnings: string[] = [];
    const notes: string[] = [];

    if (!position) {
      warnings.push("No open position found for this symbol (amount is 0).");
      notes.push("Open a Futures position to get position-specific management recommendations.");
    }

    let suggestedTakeProfit: number | null = null;
    let suggestedStopLoss: number | null = null;

    if (position) {
      const dir = positionDirection(position);
      if (dir !== "FLAT") {
        suggestedTakeProfit = computeTakeProfitFromTargetRoi({
          entryPrice: position.entryPrice,
          dir,
          leverage: position.leverage,
          targetRoiPct: constraints.targetRoiPct
        });
        suggestedStopLoss = computeSuggestedStopFromAtr({
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          dir,
          atr14: indicators?.atr14 ?? null
        });

        const n = computeDeterministicNotes({
          position,
          constraints,
          atr14: indicators?.atr14 ?? null
        });
        warnings.push(...n.warnings);
        notes.push(...n.notes);
      } else {
        warnings.push("Position is flat.");
      }
    }

    const llmProviders = await runAdvisorProviders({
      symbol,
      constraints,
      position,
      openOrders,
      indicators,
      deterministic: {
        suggestedStopLoss,
        suggestedTakeProfit,
        warnings,
        notes
      }
    });

    const response: FuturesPositionAnalysisResponse = {
      fetchedAt: new Date().toISOString(),
      symbol,
      constraints,
      position,
      openOrders,
      indicators,
      deterministic: {
        suggestedStopLoss,
        suggestedTakeProfit,
        warnings,
        notes
      },
      llm: {
        providers: llmProviders
      }
    };

    return response;
  });
};
