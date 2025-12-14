import type {
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
