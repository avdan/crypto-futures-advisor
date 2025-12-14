import type {
  AltBtcCandleData,
  BtcCandleData,
  FuturesKlineInterval,
  LlmCandle,
  MultiTimeframeIndicators,
  RawCandleData,
  TimeframeIndicatorSet
} from "@binance-advisor/shared";

import { atr, rsi, sma, type Candle } from "../../domain/indicators/candles.js";

type BinanceKlineRow = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  string, // quote asset volume
  number, // trades
  string, // taker buy base asset volume
  string, // taker buy quote asset volume
  string // ignore
];

export async function fetchFuturesKlines(params: {
  symbol: string;
  interval: FuturesKlineInterval;
  limit: number;
}): Promise<Candle[]> {
  const baseUrl = process.env.BINANCE_FAPI_BASE_URL ?? "https://fapi.binance.com";

  const url = new URL("/fapi/v1/klines", baseUrl);
  url.searchParams.set("symbol", params.symbol);
  url.searchParams.set("interval", params.interval);
  url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch klines (${res.status})`);
  }

  const rows = (await res.json()) as BinanceKlineRow[];
  return rows.map((row) => ({
    openTime: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: row[6]
  }));
}

async function fetchTimeframeIndicators(
  symbol: string,
  interval: FuturesKlineInterval,
  limit: number
): Promise<TimeframeIndicatorSet | null> {
  try {
    const candles = await fetchFuturesKlines({ symbol, interval, limit });
    const closes = candles.map((c) => c.close);

    return {
      interval,
      lastClose: closes.at(-1) ?? null,
      atr14: atr(candles, 14),
      rsi14: rsi(candles, 14),
      sma20: sma(closes, 20),
      sma50: sma(closes, 50)
    };
  } catch {
    return null;
  }
}

export async function fetchMultiTimeframeIndicators(params: {
  symbol: string;
  limit?: number;
}): Promise<MultiTimeframeIndicators> {
  const limit = params.limit ?? 200;

  const [m15, h1, h4, d1] = await Promise.all([
    fetchTimeframeIndicators(params.symbol, "15m", limit),
    fetchTimeframeIndicators(params.symbol, "1h", limit),
    fetchTimeframeIndicators(params.symbol, "4h", limit),
    fetchTimeframeIndicators(params.symbol, "1d", limit)
  ]);

  return { m15, h1, h4, d1 };
}

// Candle limits per timeframe for LLM input (optimized for token usage)
const RAW_CANDLE_LIMITS = {
  m15: 50,
  h1: 40,
  h4: 25,
  d1: 15
} as const;

async function fetchRawCandlesForTimeframe(
  symbol: string,
  interval: FuturesKlineInterval,
  limit: number
): Promise<LlmCandle[]> {
  try {
    const candles = await fetchFuturesKlines({ symbol, interval, limit });
    return candles.map((c) => ({
      t: c.openTime,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume
    }));
  } catch {
    return [];
  }
}

export async function fetchMultiTimeframeCandles(params: {
  symbol: string;
}): Promise<RawCandleData> {
  const [m15, h1, h4, d1] = await Promise.all([
    fetchRawCandlesForTimeframe(params.symbol, "15m", RAW_CANDLE_LIMITS.m15),
    fetchRawCandlesForTimeframe(params.symbol, "1h", RAW_CANDLE_LIMITS.h1),
    fetchRawCandlesForTimeframe(params.symbol, "4h", RAW_CANDLE_LIMITS.h4),
    fetchRawCandlesForTimeframe(params.symbol, "1d", RAW_CANDLE_LIMITS.d1)
  ]);

  return { m15, h1, h4, d1 };
}

// BTC context candle limits per mode
const BTC_CONTEXT_LIMITS = {
  advisor: { h4: 25, d1: 15, w1: 10 },
  scanner: { h4: 15, d1: 10 }
} as const;

// ALTBTC relative strength candle limits
const ALTBTC_LIMITS = {
  h4: 20,
  d1: 12
} as const;

/**
 * Fetch BTCUSDT candles for market regime context.
 * Used when analyzing ALT symbols to provide macro context.
 */
export async function fetchBtcContextCandles(params: {
  mode: "advisor" | "scanner";
  includeWeekly?: boolean;
}): Promise<BtcCandleData> {
  const limits = BTC_CONTEXT_LIMITS[params.mode];

  // Always fetch h4 and d1
  const [h4, d1] = await Promise.all([
    fetchRawCandlesForTimeframe("BTCUSDT", "4h", limits.h4),
    fetchRawCandlesForTimeframe("BTCUSDT", "1d", limits.d1)
  ]);

  // Weekly only for advisor mode when explicitly requested
  let w1: LlmCandle[] | undefined;
  if (params.includeWeekly && params.mode === "advisor") {
    // Note: Binance doesn't have 1w interval on futures, so we fetch 70 daily candles (10 weeks)
    // and aggregate into weekly bars
    const weeklyDailyCandles = await fetchRawCandlesForTimeframe("BTCUSDT", "1d", BTC_CONTEXT_LIMITS.advisor.w1 * 7);
    if (weeklyDailyCandles.length > 0) {
      w1 = aggregateDailyToWeekly(weeklyDailyCandles, BTC_CONTEXT_LIMITS.advisor.w1);
    }
  }

  return { h4, d1, w1 };
}

/**
 * Aggregate daily candles into weekly candles.
 * Takes groups of 7 daily candles and creates OHLCV weekly bars.
 */
function aggregateDailyToWeekly(dailyCandles: LlmCandle[], weekCount: number): LlmCandle[] {
  const weekly: LlmCandle[] = [];
  const daysPerWeek = 7;

  // Start from the end to get most recent weeks
  for (let i = dailyCandles.length - daysPerWeek; i >= 0 && weekly.length < weekCount; i -= daysPerWeek) {
    const weekCandles = dailyCandles.slice(i, i + daysPerWeek);
    const firstCandle = weekCandles[0];
    const lastCandle = weekCandles[weekCandles.length - 1];
    if (!firstCandle || !lastCandle) continue;

    weekly.unshift({
      t: firstCandle.t,
      o: firstCandle.o,
      h: Math.max(...weekCandles.map(c => c.h)),
      l: Math.min(...weekCandles.map(c => c.l)),
      c: lastCandle.c,
      v: weekCandles.reduce((sum, c) => sum + c.v, 0)
    });
  }

  return weekly;
}

/**
 * Derive ALTBTC symbol from ALTUSDT symbol.
 * e.g., "ZECUSDT" -> "ZECBTC"
 */
function deriveAltBtcSymbol(altUsdtSymbol: string): string | null {
  if (!altUsdtSymbol.endsWith("USDT")) return null;
  const base = altUsdtSymbol.slice(0, -4); // Remove "USDT"
  return `${base}BTC`;
}

/**
 * Fetch ALTBTC candles for relative strength analysis.
 * Returns null if the ALTBTC pair doesn't exist on Binance Futures.
 */
export async function fetchAltBtcCandles(params: {
  altSymbol: string;
}): Promise<AltBtcCandleData | null> {
  const altBtcSymbol = deriveAltBtcSymbol(params.altSymbol);
  if (!altBtcSymbol) return null;

  try {
    const [h4, d1] = await Promise.all([
      fetchRawCandlesForTimeframe(altBtcSymbol, "4h", ALTBTC_LIMITS.h4),
      fetchRawCandlesForTimeframe(altBtcSymbol, "1d", ALTBTC_LIMITS.d1)
    ]);

    // If both are empty, the pair likely doesn't exist
    if (h4.length === 0 && d1.length === 0) {
      return null;
    }

    return { symbol: altBtcSymbol, h4, d1 };
  } catch {
    // Pair doesn't exist or fetch failed
    return null;
  }
}
