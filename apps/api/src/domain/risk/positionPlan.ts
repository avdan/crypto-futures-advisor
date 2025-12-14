import type {
  CalculatedEquityTarget,
  CalculatedEquityTargets,
  FuturesPosition,
  RiskConstraints
} from "@binance-advisor/shared";

export type PositionDirection = "LONG" | "SHORT" | "FLAT";

export function positionDirection(position: FuturesPosition): PositionDirection {
  if (position.positionSide === "LONG") return "LONG";
  if (position.positionSide === "SHORT") return "SHORT";
  if (position.amount > 0) return "LONG";
  if (position.amount < 0) return "SHORT";
  return "FLAT";
}

export function liquidationDistancePct(position: FuturesPosition): number | null {
  if (!position.liquidationPrice) return null;
  if (position.markPrice <= 0) return null;

  const dir = positionDirection(position);
  if (dir === "LONG") {
    if (position.liquidationPrice >= position.markPrice) return 0;
    return ((position.markPrice - position.liquidationPrice) / position.markPrice) * 100;
  }
  if (dir === "SHORT") {
    if (position.liquidationPrice <= position.markPrice) return 0;
    return ((position.liquidationPrice - position.markPrice) / position.markPrice) * 100;
  }
  return null;
}

export function computeTakeProfitFromTargetRoi(params: {
  entryPrice: number;
  dir: "LONG" | "SHORT";
  leverage: number;
  targetRoiPct: number;
}): number | null {
  const { entryPrice, dir, leverage, targetRoiPct } = params;
  if (entryPrice <= 0) return null;
  if (leverage <= 0) return null;
  if (targetRoiPct <= 0) return null;

  const movePct = targetRoiPct / leverage / 100;
  return dir === "LONG" ? entryPrice * (1 + movePct) : entryPrice * (1 - movePct);
}

export function computeSuggestedStopFromAtr(params: {
  entryPrice: number;
  markPrice: number;
  dir: "LONG" | "SHORT";
  atr14: number | null;
  atrMultiple?: number;
}): number | null {
  const { entryPrice, markPrice, dir, atr14 } = params;
  const atrMultiple = params.atrMultiple ?? 1.5;
  if (entryPrice <= 0 || markPrice <= 0) return null;
  if (!atr14 || atr14 <= 0) return null;

  const distance = atr14 * atrMultiple;
  const candidate = dir === "LONG" ? entryPrice - distance : entryPrice + distance;

  if (dir === "LONG" && candidate >= markPrice) {
    return markPrice - distance;
  }
  if (dir === "SHORT" && candidate <= markPrice) {
    return markPrice + distance;
  }

  return candidate;
}

export function computeDeterministicNotes(params: {
  position: FuturesPosition;
  constraints: RiskConstraints;
  atr14: number | null;
}): { warnings: string[]; notes: string[] } {
  const { position, constraints } = params;
  const warnings: string[] = [];
  const notes: string[] = [];

  if (position.leverage > constraints.maxLeverage) {
    warnings.push(
      `Position leverage is ${position.leverage}x, above your max of ${constraints.maxLeverage}x.`
    );
  }

  const liqDist = liquidationDistancePct(position);
  if (liqDist !== null) {
    if (liqDist < 2) warnings.push(`Liquidation is very close (~${liqDist.toFixed(2)}%).`);
    else if (liqDist < 5) warnings.push(`Liquidation is close (~${liqDist.toFixed(2)}%).`);
    else notes.push(`Liquidation distance: ~${liqDist.toFixed(2)}%.`);
  } else {
    notes.push("Liquidation price not available for this position.");
  }

  if (!params.atr14) {
    notes.push("ATR14 unavailable (kline fetch failed or insufficient candles).");
  }

  notes.push(
    `Target ROI per trade: ${constraints.targetRoiPct}% (max leverage ${constraints.maxLeverage}x).`
  );
  notes.push(`Risk per trade (planning): ${constraints.riskPerTradePct}% of account.`);

  return { warnings, notes };
}

/**
 * Calculate the required price levels to achieve equity return targets.
 *
 * Formula:
 * - profit_required = wallet_equity × (target_percent / 100)
 * - price_move = profit_required / abs(position_qty)
 * - LONG: required_price = entry_price + price_move
 * - SHORT: required_price = entry_price - price_move
 */
export function computeEquityTargets(params: {
  position: FuturesPosition;
  walletEquity: number;
  targetReturnPct: number;
  stretchReturnPct: number[];
}): CalculatedEquityTargets | null {
  const { position, walletEquity, targetReturnPct, stretchReturnPct } = params;

  const dir = positionDirection(position);
  if (dir === "FLAT") return null;
  if (walletEquity <= 0) return null;
  if (position.amount === 0) return null;

  const absQty = Math.abs(position.amount);
  const entry = position.entryPrice;

  function calcTarget(percent: number): CalculatedEquityTarget {
    const profitRequired = walletEquity * (percent / 100);
    const priceMove = profitRequired / absQty;
    const requiredPrice = dir === "LONG" ? entry + priceMove : entry - priceMove;

    return {
      percent,
      profit_required: profitRequired,
      required_price: requiredPrice
    };
  }

  return {
    direction: dir,
    entry_price: entry,
    position_qty: position.amount,
    wallet_equity: walletEquity,
    minimum_target: calcTarget(targetReturnPct),
    stretch_targets: stretchReturnPct.map(calcTarget)
  };
}
