import type { SetupCandidate, TrendDirection } from "@binance-advisor/shared";
import type { FuturesKlineInterval, RiskConstraints } from "@binance-advisor/shared";

import { atr, rsi, sma } from "../indicators/candles.js";
import type { Candle } from "../indicators/candles.js";
import { runDetectors } from "./detectors.js";

import { fetchFuturesKlines } from "../../services/binance/publicFutures.js";

type ScanTimeframe = "15m" | "1h";

type ScanConfig = {
  trendTimeframe: "4h";
  timeframes: ScanTimeframe[];
  klineLimit: number;
  concurrency: number;
};

type SymbolError = { symbol: string; message: string };

function computeTrend4h(candles: Candle[]): TrendDirection {
  const closes = candles.map((c) => c.close);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  if (!sma50 || !sma200) return "NEUTRAL";

  const buffer = 0.001;
  if (sma50 > sma200 * (1 + buffer)) return "UP";
  if (sma50 < sma200 * (1 - buffer)) return "DOWN";
  return "NEUTRAL";
}

function computeIndicators(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  return {
    atr14: atr(candles, 14),
    rsi14: rsi(candles, 14),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50)
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await fn(items[currentIndex]!);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runSetupScan(params: {
  symbols: string[];
  constraints: RiskConstraints;
  config: ScanConfig;
}): Promise<{ results: SetupCandidate[]; errors: SymbolError[] }> {
  const createdAt = new Date().toISOString();

  const errors: SymbolError[] = [];

  const symbolResults = await mapWithConcurrency(
    params.symbols,
    params.config.concurrency,
    async (symbol) => {
      try {
        const trendCandles = await fetchFuturesKlines({
          symbol,
          interval: params.config.trendTimeframe as FuturesKlineInterval,
          limit: Math.max(params.config.klineLimit, 260)
        });
        const trend4h = computeTrend4h(trendCandles);

        const setups: SetupCandidate[] = [];

        for (const timeframe of params.config.timeframes) {
          try {
            const candles = await fetchFuturesKlines({
              symbol,
              interval: timeframe as FuturesKlineInterval,
              limit: params.config.klineLimit
            });
            const indicators = computeIndicators(candles);

            const detected = runDetectors({
              symbol,
              timeframe,
              trend4h,
              candles,
              indicators,
              createdAt,
              maxLeverage: params.constraints.maxLeverage,
              targetRoiPct: params.constraints.targetRoiPct
            });

            setups.push(...detected);
          } catch (err) {
            errors.push({
              symbol,
              message: `${timeframe} klines failed: ${err instanceof Error ? err.message : "Unknown error"}`
            });
          }
        }

        return setups;
      } catch (err) {
        errors.push({
          symbol,
          message: `4h trend fetch failed: ${err instanceof Error ? err.message : "Unknown error"}`
        });
        return [] as SetupCandidate[];
      }
    }
  );

  const results = symbolResults
    .flat()
    .filter((s) =>
      [
        isFiniteNumber(s.score),
        isFiniteNumber(s.entry),
        isFiniteNumber(s.stopLoss),
        isFiniteNumber(s.takeProfit)
      ].every(Boolean)
    )
    .sort((a, b) => b.score - a.score);

  return { results, errors };
}

