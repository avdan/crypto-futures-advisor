import type { FuturesKlineInterval } from "@binance-advisor/shared";

import type { Candle } from "../../domain/indicators/candles.js";

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

