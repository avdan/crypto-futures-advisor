export type HealthzResponse = {
  status: "ok";
  service: string;
  timestamp: string;
  uptimeSec: number;
  binance: {
    configured: boolean;
    futuresBaseUrl: string;
    ping: {
      status: "ok" | "error" | "unknown";
      checkedAt: string | null;
      latencyMs: number | null;
      error: string | null;
    };
  };
  openai: {
    configured: boolean;
  };
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export type FuturesPosition = {
  symbol: string;
  positionSide: "BOTH" | "LONG" | "SHORT";
  marginType: "isolated" | "cross";
  amount: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  notional: number;
  leverage: number;
  liquidationPrice: number | null;
  isolatedMargin: number | null;
  updatedAt: string | null;
};

export type FuturesPositionsResponse = {
  fetchedAt: string;
  positions: FuturesPosition[];
};

export type FuturesOpenOrder = {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  side: "BUY" | "SELL";
  positionSide: "BOTH" | "LONG" | "SHORT";
  type: string;
  status: string;
  timeInForce: string;
  reduceOnly: boolean;
  price: number;
  origQty: number;
  executedQty: number;
  stopPrice: number | null;
  time: string | null;
  updateTime: string | null;
};

export type FuturesOpenOrdersResponse = {
  fetchedAt: string;
  orders: FuturesOpenOrder[];
};
