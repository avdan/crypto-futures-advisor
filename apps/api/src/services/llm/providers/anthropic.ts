import type { AdvisorRecommendation, UserTradingProfile } from "@binance-advisor/shared";

import { advisorRecommendationJsonSchema, setupsSummaryJsonSchema } from "../schemas.js";

// Default timeout: 60s for complex analysis
const DEFAULT_TIMEOUT_MS = 60_000;
// Default max tokens: 4000 for detailed recommendations
const DEFAULT_MAX_TOKENS = 4_000;

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: string; [k: string]: unknown };

type AnthropicResponse = {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicContent[];
  model?: string;
  stop_reason?: string;
  stop_sequence?: string | null;
  usage?: { input_tokens: number; output_tokens: number };
  error?: { type: string; message: string };
};

function formatAnthropicError(err: unknown, context: string, timeoutMs: number): Error {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("aborted")) {
      return new Error(
        `Claude Timeout [${context}]: Request aborted after ${timeoutMs}ms. ` +
        `Consider increasing timeoutMs or reducing input size.`
      );
    }
    if (err.message.includes("fetch")) {
      return new Error(`Claude Network Error [${context}]: ${err.message}`);
    }
    return new Error(`Claude Error [${context}]: ${err.message}`);
  }
  return new Error(`Claude Unknown Error [${context}]: ${String(err)}`);
}

function formatResponseDebug(body: AnthropicResponse | null, status?: number): string {
  if (!body) return `status=${status}, body=null`;
  return JSON.stringify({
    id: body.id,
    type: body.type,
    model: body.model,
    stop_reason: body.stop_reason,
    usage: body.usage,
    error: body.error,
    content_types: body.content?.map(c => c.type)
  }, null, 2);
}

function getFirstToolInput(body: AnthropicResponse, toolName: string, context: string): unknown {
  const content = body.content;
  if (!Array.isArray(content)) {
    throw new Error(
      `Claude response missing content [${context}]\n` +
      `Response: ${formatResponseDebug(body)}`
    );
  }

  const toolUse = content.find(
    (c) => c.type === "tool_use" && "name" in c && c.name === toolName
  ) as { type: "tool_use"; name: string; input: unknown } | undefined;

  if (toolUse?.input !== undefined) return toolUse.input;

  const text = content.find((c) => c.type === "text" && typeof (c as any).text === "string") as
    | { type: "text"; text: string }
    | undefined;

  if (!text?.text) {
    throw new Error(
      `Claude response missing tool call "${toolName}" and text fallback [${context}]\n` +
      `Response: ${formatResponseDebug(body)}`
    );
  }

  try {
    return JSON.parse(text.text);
  } catch (err) {
    throw new Error(
      `Claude response was not valid JSON [${context}]: ${err instanceof Error ? err.message : "parse error"}\n` +
      `Text content: ${text.text.slice(0, 500)}${text.text.length > 500 ? "..." : ""}`
    );
  }
}

function assertAdvisorRecommendation(value: unknown): AdvisorRecommendation {
  if (!value || typeof value !== "object") throw new Error("Advisor recommendation is not an object");
  return value as AdvisorRecommendation;
}

type InputWithProfile = {
  userProfile?: UserTradingProfile;
  userContext?: string | null;
  account?: {
    wallet_equity: number;
    target_return_equity_percent: number;
    stretch_return_equity_percent: number[];
  };
  multi_timeframe_indicators?: unknown;
  [key: string]: unknown;
};

function buildAdvisorSystemPrompt(input: InputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;
  const account = input.account;
  const hasMultiTimeframe = Boolean(input.multi_timeframe_indicators);

  const lines = [
    "You are a professional discretionary trader and market structure analyst.",
    "You evaluate price action objectively using multi-timeframe structure.",
    "You do not use emotional language, do not panic, and do not bias toward protecting the user.",
    "Your job is to assess STRUCTURE, not feelings.",
    "",
    "## CORE TRADING PHILOSOPHY (FOLLOW STRICTLY)",
    "1. Being in profit is NOT a reason to exit - exits are structure-based ONLY",
    "2. Trades are exited or reduced ONLY if structural behavior degrades",
    "3. All valid trades must retain at least 10% of account equity return potential",
    "4. Some trades may extend to 20-30%+ equity returns - these should be managed, not prematurely capped",
    "5. Profit management is structure-based, NOT emotion or time-based",
    "6. Higher timeframes ALWAYS override lower timeframes",
    "7. Green candles after dumps are NOT bullish unless key levels are reclaimed",
    "8. A losing position can still be VALID if structure holds",
    "",
    "## ANALYSIS RULES",
    "1. Start analysis from the highest timeframe available and move downward",
    "2. Ignore 1m and 5m charts unless explicitly requested",
    "3. Never suggest adding to a position unless explicitly asked",
    "4. If a position is invalidated, state it clearly and explain why",
    "5. If a position is still valid, state it even if price is bouncing against you",
    "6. Do NOT use emotional or alarmist language",
    "7. Always define explicit invalidation and continuation levels",
    "8. Treat weekend and low-liquidity moves with reduced confidence",
    "",
    "Before answering, ask yourself: \"Has the higher timeframe structure actually changed?\"",
    "If the answer is NO, state: \"This move is noise within the existing structure.\"",
    ""
  ];

  if (hasMultiTimeframe) {
    lines.push("## MULTI-TIMEFRAME ANALYSIS");
    lines.push("- Daily and 4H define the higher timeframe bias (populate higher_timeframe_bias)");
    lines.push("- 1H and 15m define lower timeframe behavior (populate lower_timeframe_behavior)");
    lines.push("- Describe what each timeframe shows behaviorally, not just indicator values");
    lines.push("");
  }

  if (account) {
    lines.push("## EQUITY POTENTIAL CALCULATION");
    lines.push(`- Current wallet equity: $${account.wallet_equity.toFixed(2)}`);
    lines.push(`- Minimum target: ${account.target_return_equity_percent}% equity return`);
    lines.push(`- Stretch targets: ${account.stretch_return_equity_percent.join("%, ")}% equity returns`);
    lines.push("- Calculate if each target is reachable from the current position");
    lines.push("- Set required_price_level to the price needed to hit each target");
    lines.push("- If in profit, evaluate if the remaining move can still reasonably reach targets");
    lines.push("");
  }

  lines.push("## REQUIRED OUTPUT FIELDS");
  lines.push("- trade_quality: Grade A (strong thesis), B (acceptable), or DEGRADED (structure weakening)");
  lines.push("- position_status: VALID (structure holds) or INVALIDATED (structure broken)");
  lines.push("- higher_timeframe_bias: Daily and 4H direction (bearish/neutral/bullish)");
  lines.push("- lower_timeframe_behavior: Behavioral description of 1H and 15m");
  lines.push("- key_levels: Important invalidation (against position) and continuation (with position) price levels");
  lines.push("- scenarios: 2-3 probability-weighted scenarios with probabilities summing to ~1.0");
  lines.push("- equity_potential: Whether 10% and 20-30% targets are reachable with required price levels");
  lines.push("- management_guidance: Clear action (HOLD/PARTIAL_DERISK/FULL_EXIT) with structure-based rationale");
  lines.push("- verdict: One calm, objective sentence summarizing the position state");
  lines.push("");

  if (profile) {
    lines.push("## USER PROFILE");
    lines.push(`- Risk appetite: ${profile.riskAppetite}`);
    lines.push(`- Max leverage for NEW setups: ${profile.maxLeverageNewSetups}x`);
    lines.push(`- Acceptable drawdown: ${profile.acceptableDrawdownPct}%`);
    lines.push("- Existing positions may exceed leverage limits - analyze objectively");
    if (profile.adviseOnTimeframes) {
      lines.push("- Suggest checking other timeframes when relevant");
    }
    lines.push("");
  }

  if (userContext) {
    lines.push(`## USER CONTEXT: ${userContext}`);
    lines.push("");
  }

  lines.push("## OUTPUT FORMAT");
  lines.push("Return structured JSON via the provided tool call.");

  return lines.join("\n").trim();
}

function buildSetupsSummarySystemPrompt(input: InputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;

  const lines = [
    "You are a trading assistant summarizing rule-based scan results.",
    "Return ONLY structured JSON via the provided tool call.",
    "Write a compact summary of the top setups with clear entry/stop/TP and key invalidation.",
    "Do not add disclaimers.",
    ""
  ];

  if (profile) {
    lines.push("USER PROFILE:");
    lines.push(`- Risk appetite: ${profile.riskAppetite}`);
    lines.push(`- Max leverage for NEW setups: ${profile.maxLeverageNewSetups}x`);
    lines.push("");
    lines.push("- Only suggest setups within the user's leverage limits");
    if (profile.adviseOnTimeframes) {
      lines.push("- Mention which timeframes to watch");
    }
    lines.push("");
  }

  if (userContext) {
    lines.push(`USER CONTEXT: ${userContext}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function generateClaudeAdvisorRecommendation(params: {
  apiKey: string;
  model: string;
  maxTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<AdvisorRecommendation> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const system = buildAdvisorSystemPrompt(params.input as InputWithProfile);

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
          system,
          messages: [
            {
              role: "user",
              content: JSON.stringify(params.input)
            }
          ],
          tools: [
            {
              name: advisorRecommendationJsonSchema.name,
              description: "Structured trade management recommendation",
              input_schema: advisorRecommendationJsonSchema.schema
            }
          ],
          tool_choice: {
            type: "tool",
            name: advisorRecommendationJsonSchema.name
          }
        })
      });
    } catch (err) {
      throw formatAnthropicError(err, "generateClaudeAdvisorRecommendation", timeoutMs);
    }

    const body = (await res.json().catch(() => null)) as AnthropicResponse | null;

    if (!res.ok) {
      throw new Error(
        `Claude API Error [generateClaudeAdvisorRecommendation] status=${res.status}\n` +
        `Response: ${formatResponseDebug(body, res.status)}`
      );
    }

    if (!body) {
      throw new Error(
        `Claude returned empty response [generateClaudeAdvisorRecommendation] status=${res.status}`
      );
    }

    const json = getFirstToolInput(body, advisorRecommendationJsonSchema.name, "generateClaudeAdvisorRecommendation");
    return assertAdvisorRecommendation(json);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateClaudeSetupsSummary(params: {
  apiKey: string;
  model: string;
  maxTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const system = buildSetupsSummarySystemPrompt(params.input as InputWithProfile);

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
          system,
          messages: [
            {
              role: "user",
              content: JSON.stringify(params.input)
            }
          ],
          tools: [
            {
              name: setupsSummaryJsonSchema.name,
              description: "Short summary of top setups",
              input_schema: setupsSummaryJsonSchema.schema
            }
          ],
          tool_choice: {
            type: "tool",
            name: setupsSummaryJsonSchema.name
          }
        })
      });
    } catch (err) {
      throw formatAnthropicError(err, "generateClaudeSetupsSummary", timeoutMs);
    }

    const body = (await res.json().catch(() => null)) as AnthropicResponse | null;

    if (!res.ok) {
      throw new Error(
        `Claude API Error [generateClaudeSetupsSummary] status=${res.status}\n` +
        `Response: ${formatResponseDebug(body, res.status)}`
      );
    }

    if (!body) {
      throw new Error(
        `Claude returned empty response [generateClaudeSetupsSummary] status=${res.status}`
      );
    }

    const json = getFirstToolInput(body, setupsSummaryJsonSchema.name, "generateClaudeSetupsSummary") as { summary?: unknown };
    if (!json || typeof json !== "object" || typeof json.summary !== "string") {
      throw new Error(
        `Claude summary response was invalid [generateClaudeSetupsSummary]\n` +
        `Parsed JSON: ${JSON.stringify(json)}`
      );
    }

    return json.summary;
  } finally {
    clearTimeout(timeoutId);
  }
}
