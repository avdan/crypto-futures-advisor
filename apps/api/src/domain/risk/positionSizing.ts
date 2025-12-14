import type { PositionSizing, SetupDirection } from "@binance-advisor/shared";

export type PositionSizingInput = {
  walletEquity: number;
  riskPerTradePct: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  direction: SetupDirection;
  maxLeverage?: number;
};

export function calculatePositionSizing(input: PositionSizingInput): PositionSizing | null {
  const { walletEquity, riskPerTradePct, entry, stopLoss, takeProfit, direction, maxLeverage } = input;

  if (walletEquity <= 0 || entry <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    return null;
  }

  // Calculate stop distance as percentage
  const stopDistance = Math.abs(entry - stopLoss);
  const stopDistancePct = stopDistance / entry;

  if (stopDistancePct <= 0 || stopDistancePct >= 1) {
    return null;
  }

  // Risk amount in USD based on risk per trade %
  const riskUsd = walletEquity * (riskPerTradePct / 100);

  // Position size (notional) = risk / stop distance %
  // If we risk $100 and stop is 2% away, we can take a $5000 position
  let notionalUsd = riskUsd / stopDistancePct;

  // Calculate effective leverage required
  let leverageRequired = notionalUsd / walletEquity;

  // Cap position size if max leverage is specified
  if (maxLeverage && leverageRequired > maxLeverage) {
    leverageRequired = maxLeverage;
    notionalUsd = walletEquity * maxLeverage;
  }

  // Token quantity
  const quantity = notionalUsd / entry;

  // Actual risk with potentially capped position
  const actualRiskUsd = quantity * stopDistance;

  // Calculate reward
  const tpDistance = Math.abs(takeProfit - entry);
  const rewardUsd = quantity * tpDistance;

  // Risk as percentage of wallet
  const riskPct = (actualRiskUsd / walletEquity) * 100;

  return {
    quantity: roundToSignificant(quantity, 6),
    notionalUsd: roundToSignificant(notionalUsd, 2),
    riskUsd: roundToSignificant(actualRiskUsd, 2),
    rewardUsd: roundToSignificant(rewardUsd, 2),
    riskPct: roundToSignificant(riskPct, 2),
    leverageRequired: roundToSignificant(leverageRequired, 2)
  };
}

function roundToSignificant(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
