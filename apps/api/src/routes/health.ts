import type { FastifyPluginAsync } from "fastify";
import type { HealthzResponse } from "@binance-advisor/shared";

import { getAnthropicConfig, getOpenAiConfig } from "../config.js";

function isBinanceConfigured() {
  return Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
}

type BinancePing = HealthzResponse["binance"]["ping"];

const BINANCE_PING_TTL_MS = 30_000;
const BINANCE_PING_TIMEOUT_MS = 1500;

let lastPing: BinancePing = {
  status: "unknown",
  checkedAt: null,
  latencyMs: null,
  error: null
};
let lastPingAtMs = 0;
let pingInFlight: Promise<BinancePing> | null = null;

async function pingBinanceFutures(baseUrl: string): Promise<BinancePing> {
  const now = Date.now();
  if (now - lastPingAtMs < BINANCE_PING_TTL_MS) return lastPing;
  if (pingInFlight) return await pingInFlight;

  pingInFlight = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BINANCE_PING_TIMEOUT_MS);
    const checkedAt = new Date().toISOString();
    const start = Date.now();

    try {
      const url = new URL("/fapi/v1/ping", baseUrl);
      const res = await fetch(url, { signal: controller.signal });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        lastPing = {
          status: "error",
          checkedAt,
          latencyMs,
          error: `HTTP ${res.status}`
        };
      } else {
        lastPing = { status: "ok", checkedAt, latencyMs, error: null };
      }

      lastPingAtMs = now;
      return lastPing;
    } catch (err) {
      const latencyMs = Date.now() - start;
      lastPing = {
        status: "error",
        checkedAt,
        latencyMs,
        error: err instanceof Error ? err.message : "Unknown error"
      };
      lastPingAtMs = now;
      return lastPing;
    } finally {
      clearTimeout(timeoutId);
      pingInFlight = null;
    }
  })();

  return await pingInFlight;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/healthz", async () => {
    const futuresBaseUrl = process.env.BINANCE_FAPI_BASE_URL ?? "https://fapi.binance.com";
    const ping = await pingBinanceFutures(futuresBaseUrl);
    const openAi = getOpenAiConfig();
    const anthropic = getAnthropicConfig();

    const response: HealthzResponse = {
      status: "ok",
      service: "binance-advisor-api",
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      binance: {
        configured: isBinanceConfigured(),
        futuresBaseUrl,
        ping
      },
      openai: {
        configured: Boolean(openAi),
        model: openAi?.model ?? null,
        maxCompletionTokens: openAi?.maxCompletionTokens ?? null
      },
      anthropic: {
        configured: Boolean(anthropic),
        model: anthropic?.model ?? null,
        maxTokens: anthropic?.maxTokens ?? null
      }
    };

    return response;
  });

  app.get("/readyz", async () => ({
    status: "ok",
    service: "binance-advisor-api"
  }));
};
