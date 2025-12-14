import type { SetupCandidate, SetupDirection, SetupStrategy, TrendDirection } from "@binance-advisor/shared";

import type { Candle } from "../indicators/candles.js";
import { sma } from "../indicators/candles.js";

type IndicatorSnapshot = {
  atr14: number | null;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
};

type DetectorInput = {
  symbol: string;
  timeframe: "15m" | "1h";
  trend4h: TrendDirection;
  candles: Candle[];
  indicators: IndicatorSnapshot;
  createdAt: string;
  maxLeverage: number;
  targetRoiPct: number;
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function rrLong(entry: number, stop: number, tp: number): number | null {
  const risk = entry - stop;
  const reward = tp - entry;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function rrShort(entry: number, stop: number, tp: number): number | null {
  const risk = stop - entry;
  const reward = entry - tp;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function takeProfitFromTarget(params: {
  entry: number;
  dir: SetupDirection;
  maxLeverage: number;
  targetRoiPct: number;
}): number {
  const movePct = params.targetRoiPct / Math.max(1, params.maxLeverage) / 100;
  return params.dir === "LONG" ? params.entry * (1 + movePct) : params.entry * (1 - movePct);
}

function tolerance(params: { lastClose: number; atr14: number | null }): number {
  const pct = params.lastClose * 0.0015;
  const atrBased = params.atr14 ? params.atr14 * 0.25 : 0;
  return Math.max(pct, atrBased);
}

function volumeBoost(candles: Candle[]): number {
  if (candles.length < 25) return 0;
  const vols = candles.map((c) => c.volume);
  const volSma20 = sma(vols, 20);
  const lastVol = vols.at(-1) ?? 0;
  if (!volSma20 || volSma20 <= 0) return 0;
  return lastVol > volSma20 * 1.2 ? 5 : 0;
}

function scoreBase(params: {
  trendAligned: boolean;
  rr: number | null;
  rsi14: number | null;
  dir: SetupDirection;
  candles: Candle[];
}): { score: number; reasons: string[] } {
  let score = 45;
  const reasons: string[] = [];

  if (params.trendAligned) {
    score += 20;
    reasons.push("Aligned with 4h trend filter.");
  } else {
    score -= 20;
    reasons.push("Not aligned with 4h trend filter.");
  }

  if (params.rr !== null) {
    if (params.rr >= 2.5) score += 18;
    else if (params.rr >= 2) score += 14;
    else if (params.rr >= 1.5) score += 10;
    else if (params.rr >= 1.2) score += 6;
    else score += 0;
  }

  if (params.rsi14 !== null) {
    if (params.dir === "LONG") {
      if (params.rsi14 >= 45 && params.rsi14 <= 65) {
        score += 10;
        reasons.push("RSI in a healthy long continuation range.");
      } else if (params.rsi14 > 75) {
        score -= 6;
        reasons.push("RSI is high (risk of pullback).");
      }
    } else {
      if (params.rsi14 >= 35 && params.rsi14 <= 55) {
        score += 10;
        reasons.push("RSI in a healthy short continuation range.");
      } else if (params.rsi14 < 25) {
        score -= 6;
        reasons.push("RSI is low (risk of bounce).");
      }
    }
  }

  score += volumeBoost(params.candles);

  return { score, reasons };
}

function detectBreakoutRetest(input: DetectorInput): SetupCandidate[] {
  const { candles, indicators } = input;
  if (candles.length < 40) return [];

  const wantLong = input.trend4h === "UP";
  const wantShort = input.trend4h === "DOWN";
  if (!wantLong && !wantShort) return [];

  const current = candles.at(-1)!;
  const tol = tolerance({ lastClose: current.close, atr14: indicators.atr14 });
  const bufferPct = 0.001;
  const basePeriod = 20;
  const breakoutLookback = 12;

  let breakoutLevel: number | null = null;
  let dir: SetupDirection | null = null;

  for (let i = candles.length - breakoutLookback - 1; i < candles.length - 1; i += 1) {
    if (i - basePeriod < 0) continue;

    const prior = candles.slice(i - basePeriod, i);
    const maxHigh = Math.max(...prior.map((c) => c.high));
    const minLow = Math.min(...prior.map((c) => c.low));

    const c = candles[i]!;

    if (wantLong && c.close > maxHigh * (1 + bufferPct)) {
      breakoutLevel = maxHigh;
      dir = "LONG";
    }
    if (wantShort && c.close < minLow * (1 - bufferPct)) {
      breakoutLevel = minLow;
      dir = "SHORT";
    }
  }

  if (!breakoutLevel || !dir) return [];

  const retestOk =
    dir === "LONG"
      ? current.low <= breakoutLevel + tol &&
        current.close >= breakoutLevel - tol &&
        current.close <= breakoutLevel + tol * 2 &&
        current.close >= current.open
      : current.high >= breakoutLevel - tol &&
        current.close <= breakoutLevel + tol &&
        current.close >= breakoutLevel - tol * 2 &&
        current.close <= current.open;

  if (!retestOk) return [];

  const entry = breakoutLevel;
  const tp = takeProfitFromTarget({
    entry,
    dir,
    maxLeverage: input.maxLeverage,
    targetRoiPct: input.targetRoiPct
  });

  const stopDistance = (indicators.atr14 ?? tol) * 1.5;
  const stopLoss = dir === "LONG" ? entry - stopDistance : entry + stopDistance;
  const rr = dir === "LONG" ? rrLong(entry, stopLoss, tp) : rrShort(entry, stopLoss, tp);

  const base = scoreBase({
    trendAligned: true,
    rr,
    rsi14: indicators.rsi14,
    dir,
    candles
  });

  const reasons = [
    ...base.reasons,
    "Breakout occurred recently; current candle is a retest near the breakout level."
  ];

  const invalidation =
    dir === "LONG"
      ? [`Close below ${Math.max(0, entry - tol).toFixed(4)} on ${input.timeframe}.`]
      : [`Close above ${Math.max(0, entry + tol).toFixed(4)} on ${input.timeframe}.`];

  const setup: SetupCandidate = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    trend4h: input.trend4h,
    direction: dir,
    strategy: "BREAKOUT_RETEST",
    score: clampScore(base.score + 10),
    entry,
    entryZone: [entry - tol * 0.5, entry + tol * 0.5],
    stopLoss,
    takeProfit: tp,
    rr,
    reasons,
    invalidation,
    createdAt: input.createdAt
  };

  return [setup];
}

function detectTrendPullback(input: DetectorInput): SetupCandidate[] {
  const { candles, indicators } = input;
  if (candles.length < 60) return [];
  if (input.trend4h !== "UP" && input.trend4h !== "DOWN") return [];

  const current = candles.at(-1)!;
  const prev = candles.at(-2)!;

  const tol = tolerance({ lastClose: current.close, atr14: indicators.atr14 });

  const wantLong = input.trend4h === "UP";
  const dir: SetupDirection = wantLong ? "LONG" : "SHORT";

  const sma20v = indicators.sma20;
  const sma50v = indicators.sma50;
  if (!sma20v || !sma50v) return [];

  const near20 =
    wantLong ? current.low <= sma20v + tol : current.high >= sma20v - tol;
  const near50 =
    wantLong ? current.low <= sma50v + tol : current.high >= sma50v - tol;

  const reclaim = wantLong ? current.close >= sma20v : current.close <= sma20v;
  const momentum = wantLong ? current.close >= current.open : current.close <= current.open;
  const pullbackCandle = wantLong ? prev.close < prev.open : prev.close > prev.open;

  const rsiOk =
    indicators.rsi14 === null
      ? true
      : wantLong
        ? indicators.rsi14 >= 40 && indicators.rsi14 <= 65
        : indicators.rsi14 >= 35 && indicators.rsi14 <= 60;

  if (!(reclaim && momentum && pullbackCandle && rsiOk && (near20 || near50))) return [];

  const entry = current.close;
  const stopDistance = (indicators.atr14 ?? tol) * 1.2;
  const stopLoss = wantLong ? current.low - stopDistance : current.high + stopDistance;
  const tp = takeProfitFromTarget({
    entry,
    dir,
    maxLeverage: input.maxLeverage,
    targetRoiPct: input.targetRoiPct
  });
  const rr = wantLong ? rrLong(entry, stopLoss, tp) : rrShort(entry, stopLoss, tp);

  const base = scoreBase({
    trendAligned: true,
    rr,
    rsi14: indicators.rsi14,
    dir,
    candles
  });

  const reasons = [
    ...base.reasons,
    `Pullback into moving averages (${near20 ? "SMA20" : "SMA50"}) with reclaim.`
  ];
  const invalidation =
    wantLong
      ? [`Close below ${stopLoss.toFixed(4)} on ${input.timeframe}.`]
      : [`Close above ${stopLoss.toFixed(4)} on ${input.timeframe}.`];

  const setup: SetupCandidate = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    trend4h: input.trend4h,
    direction: dir,
    strategy: "TREND_PULLBACK",
    score: clampScore(base.score + 8),
    entry,
    entryZone: null,
    stopLoss,
    takeProfit: tp,
    rr,
    reasons,
    invalidation,
    createdAt: input.createdAt
  };

  return [setup];
}

function detectContinuation(input: DetectorInput): SetupCandidate[] {
  const { candles, indicators } = input;
  if (candles.length < 80) return [];
  if (input.trend4h !== "UP" && input.trend4h !== "DOWN") return [];

  const current = candles.at(-1)!;
  const sma20v = indicators.sma20;
  const sma50v = indicators.sma50;
  if (!sma20v || !sma50v) return [];

  const wantLong = input.trend4h === "UP";
  const dir: SetupDirection = wantLong ? "LONG" : "SHORT";

  const maAligned = wantLong ? sma20v > sma50v : sma20v < sma50v;
  if (!maAligned) return [];

  const lookback = 20;
  if (candles.length < lookback + 2) return [];

  const prior = candles.slice(-lookback - 1, -1);
  const maxHigh = Math.max(...prior.map((c) => c.high));
  const minLow = Math.min(...prior.map((c) => c.low));

  const bufferPct = 0.001;
  const breakoutOk = wantLong
    ? current.close > maxHigh * (1 + bufferPct)
    : current.close < minLow * (1 - bufferPct);

  if (!breakoutOk) return [];

  const entry = current.close;
  const stopDistance = (indicators.atr14 ?? (entry * 0.002)) * 1.8;
  const stopLoss = wantLong ? entry - stopDistance : entry + stopDistance;
  const tp = takeProfitFromTarget({
    entry,
    dir,
    maxLeverage: input.maxLeverage,
    targetRoiPct: input.targetRoiPct
  });
  const rr = wantLong ? rrLong(entry, stopLoss, tp) : rrShort(entry, stopLoss, tp);

  const base = scoreBase({
    trendAligned: true,
    rr,
    rsi14: indicators.rsi14,
    dir,
    candles
  });

  const reasons = [...base.reasons, "Trend continuation breakout from recent range."];
  const invalidation =
    wantLong
      ? [`Close back inside the prior range (below ${maxHigh.toFixed(4)}).`]
      : [`Close back inside the prior range (above ${minLow.toFixed(4)}).`];

  const setup: SetupCandidate = {
    symbol: input.symbol,
    timeframe: input.timeframe,
    trend4h: input.trend4h,
    direction: dir,
    strategy: "CONTINUATION",
    score: clampScore(base.score + 6),
    entry,
    entryZone: null,
    stopLoss,
    takeProfit: tp,
    rr,
    reasons,
    invalidation,
    createdAt: input.createdAt
  };

  return [setup];
}

export function runDetectors(input: DetectorInput): SetupCandidate[] {
  const setups: SetupCandidate[] = [];
  setups.push(...detectBreakoutRetest(input));
  setups.push(...detectTrendPullback(input));
  setups.push(...detectContinuation(input));

  // Deduplicate by (strategy,direction,timeframe) per symbol (keep highest score)
  const map = new Map<string, SetupCandidate>();
  for (const s of setups) {
    const key = `${s.symbol}:${s.timeframe}:${s.strategy}:${s.direction}`;
    const prev = map.get(key);
    if (!prev || s.score > prev.score) map.set(key, s);
  }

  return Array.from(map.values());
}
