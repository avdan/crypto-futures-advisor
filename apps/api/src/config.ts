import type { RiskConstraints, RiskAppetite, UserTradingProfile } from "@binance-advisor/shared";

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function getRiskConstraints(): RiskConstraints {
  const maxLeverage = toNumber(process.env.MAX_LEVERAGE) ?? 3;
  const targetRoiPct = toNumber(process.env.TARGET_ROI_PCT) ?? 10;
  const riskPerTradePct = toNumber(process.env.RISK_PER_TRADE_PCT) ?? 1;

  return {
    maxLeverage,
    targetRoiPct,
    riskPerTradePct
  };
}

export function getOpenAiConfig(): {
  apiKey: string;
  model: string;
  maxCompletionTokens: number | null;
} | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";

  const maxCompletionTokensRaw = toNumber(process.env.OPENAI_MAX_COMPLETION_TOKENS);
  const maxCompletionTokens =
    maxCompletionTokensRaw && maxCompletionTokensRaw > 0 ? Math.floor(maxCompletionTokensRaw) : null;

  return { apiKey, model, maxCompletionTokens };
}

export function getAnthropicConfig(): {
  apiKey: string;
  model: string;
  maxTokens: number | null;
} | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";

  const maxTokensRaw = toNumber(process.env.ANTHROPIC_MAX_TOKENS);
  const maxTokens = maxTokensRaw && maxTokensRaw > 0 ? Math.floor(maxTokensRaw) : null;

  return { apiKey, model, maxTokens };
}

export function getDefaultKlineInterval() {
  return (process.env.DEFAULT_KLINE_INTERVAL ?? "1h") as string;
}

export function getKlineLimit(): number {
  const limit = toNumber(process.env.KLINE_LIMIT) ?? 200;
  return Math.max(50, Math.min(limit, 500));
}

export function getTelegramConfig(): { botToken: string; chatId: string } | null {
  const enabled = toBool(process.env.TELEGRAM_ENABLED, false);
  if (!enabled) return null;

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

export function getUserTradingProfile(): UserTradingProfile {
  const riskAppetite = (process.env.RISK_APPETITE ?? "medium") as RiskAppetite;
  const maxLeverageNewSetups = toNumber(process.env.MAX_LEVERAGE_NEW_SETUPS) ?? 3;
  const acceptableDrawdownPct = toNumber(process.env.ACCEPTABLE_DRAWDOWN_PCT) ?? 30;
  const adviseOnTimeframes = toBool(process.env.ADVISE_ON_TIMEFRAMES, true);

  return {
    riskAppetite,
    maxLeverageNewSetups,
    acceptableDrawdownPct,
    adviseOnTimeframes
  };
}

export type EquityTargets = {
  targetReturnPct: number;
  stretchReturnPct: number[];
};

export function getEquityTargets(): EquityTargets {
  const targetReturnPct = toNumber(process.env.TARGET_RETURN_EQUITY_PCT) ?? 10;
  const stretchRaw = process.env.STRETCH_RETURN_EQUITY_PCT ?? "20,30";
  const stretchReturnPct = stretchRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  return {
    targetReturnPct,
    stretchReturnPct: stretchReturnPct.length > 0 ? stretchReturnPct : [20, 30]
  };
}
