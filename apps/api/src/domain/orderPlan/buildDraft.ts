import type {
  AdvisorAction,
  CreateOrderPlanDraftRequest,
  FuturesOpenOrder,
  FuturesOrderDraft,
  FuturesPosition,
  OrderPlanStep
} from "@binance-advisor/shared";

import { positionDirection } from "../risk/positionPlan.js";

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parsePercent(value: unknown): number | null {
  const n = parseNumber(value);
  if (n === null) return null;
  if (n <= 0) return null;
  return Math.min(100, n);
}

function oppositeSideForClose(position: FuturesPosition): "BUY" | "SELL" {
  const dir = positionDirection(position);
  if (dir === "LONG") return "SELL";
  if (dir === "SHORT") return "BUY";
  return position.amount >= 0 ? "SELL" : "BUY";
}

function findExistingStopOrders(openOrders: FuturesOpenOrder[]): FuturesOpenOrder[] {
  return openOrders.filter((o) => {
    const type = o.type?.toUpperCase?.() ?? "";
    const isStopType = type.includes("STOP");
    return o.reduceOnly && isStopType;
  });
}

function makePlaceOrderStep(params: {
  symbol: string;
  reason: string;
  order: FuturesOrderDraft;
}): OrderPlanStep {
  return {
    kind: "PLACE_ORDER",
    symbol: params.symbol,
    reason: params.reason,
    order: params.order
  };
}

export function buildOrderPlanDraft(params: {
  request: CreateOrderPlanDraftRequest;
  position: FuturesPosition | null;
  openOrders: FuturesOpenOrder[];
}): { steps: OrderPlanStep[]; warnings: string[] } {
  const warnings: string[] = [];
  const steps: OrderPlanStep[] = [];

  const { position, openOrders } = params;

  if (!position) {
    warnings.push("No open position found for this symbol. Cannot build an order plan.");
    return { steps, warnings };
  }

  const dir = positionDirection(position);
  if (dir === "FLAT") {
    warnings.push("Position is flat. Cannot build an order plan.");
    return { steps, warnings };
  }

  const closeSide = oppositeSideForClose(position);
  const absQty = Math.abs(position.amount);

  for (const selection of params.request.selections) {
    const action: AdvisorAction = selection.action;

    if (action.type === "MOVE_STOP") {
      const stopPrice =
        parseNumber(action.params?.stopPrice) ??
        parseNumber(action.params?.stop_loss) ??
        parseNumber(action.params?.sl) ??
        parseNumber(action.params?.price);

      if (!stopPrice) {
        warnings.push(`MOVE_STOP action (${selection.provider}) is missing a numeric stopPrice.`);
        steps.push({ kind: "NOTE", text: `(${selection.provider}) ${action.title}: ${action.reason}` });
        continue;
      }

      // Cancel existing reduce-only stop orders (draft step; no execution in this phase)
      for (const o of findExistingStopOrders(openOrders)) {
        steps.push({
          kind: "CANCEL_ORDER",
          symbol: o.symbol,
          orderId: o.orderId,
          reason: `Replace existing stop order (${o.type}).`
        });
      }

      if (dir === "LONG" && stopPrice >= position.markPrice) {
        warnings.push("Suggested stop is above/at mark price for a LONG; double-check.");
      }
      if (dir === "SHORT" && stopPrice <= position.markPrice) {
        warnings.push("Suggested stop is below/at mark price for a SHORT; double-check.");
      }

      const order: FuturesOrderDraft = {
        symbol: position.symbol,
        side: closeSide,
        type: "STOP_MARKET",
        quantity: null,
        price: null,
        stopPrice,
        reduceOnly: true,
        closePosition: true,
        timeInForce: null
      };

      steps.push(
        makePlaceOrderStep({
          symbol: position.symbol,
          reason: `Move stop to ${stopPrice}.`,
          order
        })
      );
      continue;
    }

    if (action.type === "SCALE_OUT" || action.type === "CLOSE") {
      const percent =
        parsePercent(action.params?.percent) ??
        parsePercent(action.params?.percentage) ??
        (action.type === "CLOSE" ? 100 : null);

      if (!percent) {
        warnings.push(
          `${action.type} action (${selection.provider}) is missing a numeric percent (1-100).`
        );
        steps.push({ kind: "NOTE", text: `(${selection.provider}) ${action.title}: ${action.reason}` });
        continue;
      }

      const qty = Number((absQty * (percent / 100)).toFixed(8));
      if (qty <= 0) {
        warnings.push(`${action.type} computed quantity was 0; skipping.`);
        continue;
      }

      const price =
        parseNumber(action.params?.price) ??
        parseNumber(action.params?.limitPrice) ??
        parseNumber(action.params?.takeProfitPrice) ??
        null;

      const wantsLimit = Boolean(price);

      if (wantsLimit) {
        if (dir === "LONG" && price! <= position.markPrice) {
          warnings.push("Scale-out limit price is below/at mark for a LONG; double-check.");
        }
        if (dir === "SHORT" && price! >= position.markPrice) {
          warnings.push("Scale-out limit price is above/at mark for a SHORT; double-check.");
        }
      }

      const order: FuturesOrderDraft = {
        symbol: position.symbol,
        side: closeSide,
        type: wantsLimit ? "LIMIT" : "MARKET",
        quantity: wantsLimit ? qty : qty,
        price: wantsLimit ? price : null,
        stopPrice: null,
        reduceOnly: true,
        closePosition: false,
        timeInForce: wantsLimit ? "GTC" : null
      };

      steps.push(
        makePlaceOrderStep({
          symbol: position.symbol,
          reason: `${action.type === "CLOSE" ? "Close" : "Scale out"} ${percent}% (${qty}).`,
          order
        })
      );
      continue;
    }

    // Not convertible (yet) to orders in this phase.
    steps.push({
      kind: "NOTE",
      text: `(${selection.provider}) ${action.type}: ${action.title} — not converted to orders in this phase.`
    });
  }

  return { steps, warnings };
}

