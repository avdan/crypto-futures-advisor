import type { FuturesPosition } from "@binance-advisor/shared";

export function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

export function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function positionDirection(position: FuturesPosition): "LONG" | "SHORT" | "FLAT" {
  if (position.positionSide === "LONG") return "LONG";
  if (position.positionSide === "SHORT") return "SHORT";
  if (position.amount > 0) return "LONG";
  if (position.amount < 0) return "SHORT";
  return "FLAT";
}
