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

export type RiskAppetite = "low" | "medium" | "high";

export type UserTradingProfile = {
  riskAppetite: RiskAppetite;
  maxLeverageNewSetups: number;
  acceptableDrawdownPct: number;
  adviseOnTimeframes: boolean;
};

export type FuturesPositionAnalysisRequest = {
  symbol: string;
  interval?: FuturesKlineInterval;
  userContext?: string;
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

// NEW: Enhanced advisor output types
export type TradeQualityGrade = "A" | "B" | "DEGRADED";
export type ThesisStatus = "INTACT" | "WEAKENING" | "INVALIDATED";
export type PositionStatus = "VALID" | "INVALIDATED";
export type TimeframeBias = "bearish" | "neutral" | "bullish";
export type ManagementAction = "HOLD" | "PARTIAL_DERISK" | "FULL_EXIT";

export type TradeQuality = {
  grade: TradeQualityGrade;
  original_thesis_status: ThesisStatus;
};

export type HigherTimeframeBias = {
  daily: TimeframeBias;
  h4: TimeframeBias;
};

export type LowerTimeframeBehavior = {
  h1: string;
  m15: string;
};

export type KeyLevels = {
  invalidation: number[];
  continuation: number[];
};

export type ProbabilityScenario = {
  scenario: string;
  probability: number; // 0..1
};

export type EquityTarget = {
  reachable: boolean;
  required_price_level: number | null;
};

export type EquityPotential = {
  minimum_target_10pct: EquityTarget;
  stretch_target_20_30pct: {
    reachable: boolean;
    required_price_levels: number[];
  };
};

export type ManagementGuidance = {
  recommended_action: ManagementAction;
  rationale: string;
};

export type AdvisorRecommendation = {
  // EXISTING (keep for backward compat)
  summary: string;
  confidence: number; // 0..1
  actions: AdvisorAction[];
  invalidation: string[];
  risks: string[];
  assumptions: string[];

  // NEW: Enhanced output fields (all optional for backward compat)
  trade_quality?: TradeQuality;
  position_status?: PositionStatus;
  higher_timeframe_bias?: HigherTimeframeBias;
  lower_timeframe_behavior?: LowerTimeframeBehavior;
  key_levels?: KeyLevels;
  scenarios?: ProbabilityScenario[];
  equity_potential?: EquityPotential;
  management_guidance?: ManagementGuidance;
  verdict?: string;
};

// NEW: Multi-timeframe indicator types
export type TimeframeIndicatorSet = {
  interval: FuturesKlineInterval;
  lastClose: number | null;
  atr14: number | null;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
};

export type MultiTimeframeIndicators = {
  m15: TimeframeIndicatorSet | null;
  h1: TimeframeIndicatorSet | null;
  h4: TimeframeIndicatorSet | null;
  d1: TimeframeIndicatorSet | null;
};

// NEW: Account equity types
export type AccountEquityData = {
  wallet_equity: number;
  target_return_equity_percent: number;
  stretch_return_equity_percent: number[];
};

// Account margin info for display
export type AccountMarginInfo = {
  marginRatio: number; // Maintenance margin / margin balance * 100
  maintenanceMargin: number;
  accountEquity: number; // Wallet balance
  marginBalance: number;
  positionValue: number; // Total notional of open positions
  actualLeverage: number; // Position value / account equity
  unrealizedPnl: number;
  availableBalance: number;
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
  // NEW: Multi-timeframe indicators
  multiTimeframeIndicators?: MultiTimeframeIndicators;
  // NEW: Account equity data (for LLM context)
  accountEquity?: AccountEquityData;
  // NEW: Account margin info (for display)
  accountMarginInfo?: AccountMarginInfo;
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

export type PositionSizing = {
  quantity: number; // Token quantity to buy/sell
  notionalUsd: number; // Position size in USD
  riskUsd: number; // What you lose if SL hit
  rewardUsd: number; // What you gain if TP hit
  riskPct: number; // Risk as % of wallet equity
  leverageRequired: number; // Effective leverage for this position
};

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
  // Position sizing (optional - requires account equity)
  sizing?: PositionSizing;
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
