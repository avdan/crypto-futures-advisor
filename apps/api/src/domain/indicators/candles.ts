export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export function sma(values: number[], period: number): number | null {
  if (period <= 0) return null;
  if (values.length < period) return null;
  const window = values.slice(values.length - period);
  const sum = window.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

export function atr(candles: Candle[], period = 14): number | null {
  if (period <= 0) return null;
  if (candles.length < period + 1) return null;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i]!;
    const prev = candles[i - 1]!;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }

  if (trs.length < period) return null;

  let atrValue = trs.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  for (let i = period; i < trs.length; i += 1) {
    atrValue = (atrValue * (period - 1) + trs[i]!) / period;
  }

  return atrValue;
}

export function rsi(candles: Candle[], period = 14): number | null {
  if (period <= 0) return null;
  if (candles.length < period + 1) return null;

  const closes = candles.map((c) => c.close);

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i]! - closes[i - 1]!;
    if (change >= 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i]! - closes[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
