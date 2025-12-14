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
    model: string | null;
    maxCompletionTokens: number | null;
  };
  anthropic: {
    configured: boolean;
    model: string | null;
    maxTokens: number | null;
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

export type FuturesKlineInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d";

export type RiskConstraints = {
  maxLeverage: number;
  targetRoiPct: number;
  riskPerTradePct: number;
};

export type FuturesPositionAnalysisRequest = {
  symbol: string;
  interval?: FuturesKlineInterval;
};

export type AdvisorActionType =
  | "HOLD"
  | "MOVE_STOP"
  | "SCALE_OUT"
  | "SCALE_IN"
  | "HEDGE"
  | "CLOSE";

export type AdvisorAction = {
  type: AdvisorActionType;
  title: string;
  reason: string;
  params?: Record<string, unknown>;
};

export type AdvisorRecommendation = {
  summary: string;
  confidence: number; // 0..1
  actions: AdvisorAction[];
  invalidation: string[];
  risks: string[];
  assumptions: string[];
};

export type LlmProviderId = "openai" | "anthropic";

export type LlmProviderResult<T> = {
  provider: LlmProviderId;
  enabled: boolean;
  model: string | null;
  latencyMs: number | null;
  output: T | null;
  error: string | null;
};

export type FuturesPositionAnalysisResponse = {
  fetchedAt: string;
  symbol: string;
  constraints: RiskConstraints;
  position: FuturesPosition | null;
  openOrders: FuturesOpenOrder[];
  indicators: {
    interval: FuturesKlineInterval;
    lastClose: number | null;
    atr14: number | null;
    rsi14: number | null;
    sma20: number | null;
    sma50: number | null;
  } | null;
  deterministic: {
    suggestedStopLoss: number | null;
    suggestedTakeProfit: number | null;
    warnings: string[];
    notes: string[];
  };
  llm: {
    providers: Array<LlmProviderResult<AdvisorRecommendation>>;
  };
};

export type Watchlist = {
  symbols: string[];
  updatedAt: string;
};

export type UpdateWatchlistRequest = {
  symbols: string[];
};

export type TrendDirection = "UP" | "DOWN" | "NEUTRAL";

export type SetupStrategy = "BREAKOUT_RETEST" | "TREND_PULLBACK" | "CONTINUATION";

export type SetupDirection = "LONG" | "SHORT";

export type SetupCandidate = {
  symbol: string;
  timeframe: "15m" | "1h";
  trend4h: TrendDirection;
  direction: SetupDirection;
  strategy: SetupStrategy;
  score: number; // 0..100
  entry: number;
  entryZone: [number, number] | null;
  stopLoss: number;
  takeProfit: number;
  rr: number | null;
  reasons: string[];
  invalidation: string[];
  createdAt: string;
};

export type ScannerStatusResponse = {
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

export type ScannerRunResponse = {
  runAt: string;
  watchlist: Watchlist;
  results: SetupCandidate[];
  errors: Array<{ symbol: string; message: string }>;
  llm: {
    providers: Array<LlmProviderResult<string>>;
  };
};

export type FuturesOrderSide = "BUY" | "SELL";
export type FuturesOrderType =
  | "MARKET"
  | "LIMIT"
  | "STOP_MARKET"
  | "TAKE_PROFIT_MARKET";

export type FuturesOrderDraft = {
  symbol: string;
  side: FuturesOrderSide;
  type: FuturesOrderType;
  quantity: number | null;
  price: number | null;
  stopPrice: number | null;
  reduceOnly: boolean;
  closePosition: boolean;
  timeInForce: string | null;
};

export type OrderPlanStep =
  | {
      kind: "CANCEL_ORDER";
      symbol: string;
      orderId: number;
      reason: string;
    }
  | {
      kind: "PLACE_ORDER";
      symbol: string;
      order: FuturesOrderDraft;
      reason: string;
    }
  | {
      kind: "NOTE";
      text: string;
    };

export type CreateOrderPlanDraftRequest = {
  symbol: string;
  selections: Array<{
    provider: LlmProviderId;
    action: AdvisorAction;
  }>;
};

export type CreateOrderPlanDraftResponse = {
  createdAt: string;
  symbol: string;
  steps: OrderPlanStep[];
  warnings: string[];
};

export type AlertSeverity = "INFO" | "WARN" | "CRITICAL";

export type AlertType =
  | "LIQUIDATION_RISK"
  | "STOP_PROXIMITY"
  | "TAKE_PROFIT_PROXIMITY"
  | "ENTRY_ZONE_HIT"
  | "NEW_TOP_SETUPS"
  | "SYSTEM";

export type Alert = {
  id: string;
  createdAt: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  symbol: string | null;
  dedupeKey: string;
  acknowledgedAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type AlertsResponse = {
  fetchedAt: string;
  alerts: Alert[];
};

export type AckAlertResponse = {
  updatedAt: string;
  alert: Alert;
};

export type TelegramTestRequest = {
  message?: string;
};

export type TelegramTestResponse = {
  sentAt: string;
  ok: boolean;
  error: string | null;
};
