import fs from "node:fs/promises";
import path from "node:path";

import type { ScannerRunResponse, ScannerStatusResponse, SetupCandidate } from "@binance-advisor/shared";

import { getKlineLimit, getRiskConstraints } from "../../config.js";
import { calculatePositionSizing } from "../../domain/risk/positionSizing.js";
import { runSetupScan } from "../../domain/scanner/runScan.js";
import { createFuturesClient, fetchFuturesAccountInfo } from "../binance/futures.js";
import { runSetupsSummaryProviders } from "../llm/aggregate.js";
import { resolveApiDataDir } from "../storage/paths.js";
import type { WatchlistStore } from "../watchlist/store.js";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

type ScannerConfig = {
  enabled: boolean;
  runOnStart: boolean;
  intervalMinutes: number;
  timeframes: Array<"15m" | "1h">;
  trendTimeframe: "4h";
  concurrency: number;
};

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseIntSafe(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseTimeframes(value: string | undefined): Array<"15m" | "1h"> {
  const raw = value?.trim();
  const parts = raw ? raw.split(",").map((p) => p.trim()) : ["15m", "1h"];
  const allowed = new Set(["15m", "1h"]);
  const result = parts.filter((p) => allowed.has(p)) as Array<"15m" | "1h">;
  return result.length ? Array.from(new Set(result)) : ["15m", "1h"];
}

function getScannerConfig(): ScannerConfig {
  return {
    enabled: parseBool(process.env.SCANNER_ENABLED, true),
    runOnStart: parseBool(process.env.SCANNER_RUN_ON_START, false),
    intervalMinutes: Math.max(5, parseIntSafe(process.env.SCANNER_INTERVAL_MINUTES, 60)),
    timeframes: parseTimeframes(process.env.SCANNER_TIMEFRAMES),
    trendTimeframe: "4h",
    concurrency: Math.max(1, Math.min(parseIntSafe(process.env.SCANNER_CONCURRENCY, 3), 10))
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export type ScannerService = {
  getStatus(): ScannerStatusResponse;
  getLatest(): ScannerRunResponse | null;
  runNow(): Promise<ScannerRunResponse>;
  start(): void;
  stop(): void;
};

export function createScannerService(params: {
  watchlistStore: WatchlistStore;
  logger: Logger;
}): ScannerService {
  const config = getScannerConfig();
  const dataDir = resolveApiDataDir();
  const latestFilePath = path.join(dataDir, "scanner-latest.json");

  let running = false;
  let lastRunAt: string | null = null;
  let nextRunAt: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: ScannerRunResponse | null = null;

  void (async () => {
    const existing = await readJsonFile<ScannerRunResponse>(latestFilePath);
    if (existing) {
      latest = existing;
      lastRunAt = existing.runAt;
    }
  })();

  function computeNextRunAt(fromMs: number) {
    const nextMs = fromMs + config.intervalMinutes * 60_000;
    nextRunAt = new Date(nextMs).toISOString();
    return nextMs;
  }

  async function runNow(): Promise<ScannerRunResponse> {
    if (running) {
      throw new Error("Scanner is already running.");
    }
    running = true;
    const runAt = new Date().toISOString();

    try {
      const watchlist = await params.watchlistStore.get();
      const constraints = getRiskConstraints();
      const klineLimit = getKlineLimit();

      // Fetch account equity for position sizing (optional)
      let walletEquity: number | null = null;
      const client = createFuturesClient();
      if (client) {
        try {
          const accountInfo = await fetchFuturesAccountInfo(client);
          walletEquity = accountInfo.walletEquity;
        } catch (err) {
          params.logger.warn({ err }, "Failed to fetch account equity for position sizing");
        }
      }

      const { results, errors } = await runSetupScan({
        symbols: watchlist.symbols,
        constraints,
        config: {
          trendTimeframe: config.trendTimeframe,
          timeframes: config.timeframes,
          klineLimit,
          concurrency: config.concurrency
        }
      });

      // Calculate position sizing for each setup if we have wallet equity
      const resultsWithSizing: SetupCandidate[] = results.map((setup) => {
        if (walletEquity === null || walletEquity <= 0) {
          return setup;
        }

        const sizing = calculatePositionSizing({
          walletEquity,
          riskPerTradePct: constraints.riskPerTradePct,
          entry: setup.entry,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          direction: setup.direction,
          maxLeverage: constraints.maxLeverage
        });

        return sizing ? { ...setup, sizing } : setup;
      });

      const top3: SetupCandidate[] = resultsWithSizing.slice(0, 3);
      const llmProviders =
        top3.length > 0
          ? await runSetupsSummaryProviders({
              constraints,
              top: top3
            })
          : await runSetupsSummaryProviders({
              constraints,
              top: []
            });

      const response: ScannerRunResponse = {
        runAt,
        watchlist,
        results: resultsWithSizing,
        errors,
        llm: {
          providers: llmProviders
        }
      };

      latest = response;
      lastRunAt = runAt;
      await writeJsonFile(latestFilePath, response);

      return response;
    } finally {
      running = false;
    }
  }

  function scheduleNext() {
    if (!config.enabled) return;
    if (timer) clearTimeout(timer);
    const nextMs = computeNextRunAt(Date.now());

    timer = setTimeout(async () => {
      try {
        await runNow();
        params.logger.info({ runAt: lastRunAt }, "Scanner run completed");
      } catch (err) {
        params.logger.warn({ err }, "Scanner run failed");
      } finally {
        scheduleNext();
      }
    }, nextMs - Date.now());
  }

  function start() {
    if (!config.enabled) return;
    scheduleNext();

    if (config.runOnStart) {
      setTimeout(async () => {
        try {
          await runNow();
          params.logger.info({ runAt: lastRunAt }, "Scanner initial run completed");
        } catch (err) {
          params.logger.warn({ err }, "Scanner initial run failed");
        }
      }, 1500);
    }
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
    nextRunAt = null;
  }

  function getStatus(): ScannerStatusResponse {
    return {
      running,
      lastRunAt,
      nextRunAt
    };
  }

  function getLatest() {
    return latest;
  }

  return { getStatus, getLatest, runNow, start, stop };
}
