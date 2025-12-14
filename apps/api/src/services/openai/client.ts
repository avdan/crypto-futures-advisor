import type { AdvisorRecommendation, AdvisorAction, UserTradingProfile } from "@binance-advisor/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  advisorRecommendationSchema,
  setupsSummarySchema,
  type AdvisorRecommendationOutput
} from "./schemas.js";

function parseActionParams(output: AdvisorRecommendationOutput): AdvisorRecommendation {
  return {
    ...output,
    actions: output.actions.map((action): AdvisorAction => {
      let params: Record<string, unknown> | undefined;
      if (action.params) {
        try {
          params = JSON.parse(action.params);
        } catch {
          params = undefined;
        }
      }
      return {
        type: action.type,
        title: action.title,
        reason: action.reason,
        params
      };
    })
  };
}

function formatOpenAIError(err: unknown, context: string): Error {
  if (err instanceof OpenAI.APIError) {
    const details = {
      context,
      status: err.status,
      code: err.code,
      type: err.type,
      message: err.message,
      headers: err.headers ? Object.fromEntries(Object.entries(err.headers)) : undefined
    };
    return new Error(`OpenAI API Error: ${JSON.stringify(details, null, 2)}`);
  }

  if (err instanceof OpenAI.APIConnectionError) {
    return new Error(`OpenAI Connection Error [${context}]: ${err.message} (cause: ${err.cause})`);
  }

  if (err instanceof OpenAI.RateLimitError) {
    return new Error(`OpenAI Rate Limit [${context}]: ${err.message}`);
  }

  if (err instanceof OpenAI.AuthenticationError) {
    return new Error(`OpenAI Auth Error [${context}]: ${err.message}`);
  }

  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("aborted")) {
      return new Error(`OpenAI Timeout [${context}]: Request was aborted (timeout exceeded)`);
    }
    return new Error(`OpenAI Error [${context}]: ${err.message}`);
  }

  return new Error(`OpenAI Unknown Error [${context}]: ${String(err)}`);
}

function formatResponseDebug(response: unknown): string {
  try {
    const r = response as Record<string, unknown>;
    return JSON.stringify({
      id: r.id,
      status: r.status,
      output: r.output,
      output_parsed: r.output_parsed,
      error: r.error,
      usage: r.usage
    }, null, 2);
  } catch {
    return String(response);
  }
}

function checkIncompleteResponse(response: unknown, context: string): void {
  const r = response as Record<string, unknown>;
  if (r.status === "incomplete") {
    const usage = r.usage as { output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } } | undefined;
    const outputTokens = usage?.output_tokens ?? 0;
    const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? 0;

    let hint = "";
    if (reasoningTokens > 0 && reasoningTokens >= outputTokens * 0.9) {
      hint = ` The model used ${reasoningTokens}/${outputTokens} tokens for reasoning with none left for output. ` +
        `Increase OPENAI_MAX_COMPLETION_TOKENS to 8000+ for reasoning models (gpt-5, o1, o3).`;
    }

    throw new Error(
      `OpenAI response incomplete [${context}]: Model did not finish generating.${hint}\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }
}

// Default timeout: 60s for reasoning models which can take longer
const DEFAULT_TIMEOUT_MS = 60_000;
// Default max tokens: 16000 for reasoning models (they need room for both reasoning + output)
// Reasoning can use 2k-8k+ tokens internally, plus ~500-1k for actual JSON output
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;

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

function buildAdvisorInstructions(input: InputWithProfile): string {
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
  lines.push("Return ONLY a JSON object matching the provided schema.");
  lines.push("For action params in the actions array, provide a JSON string or null.");

  return lines.join("\n").trim();
}

function buildSetupsSummaryInstructions(input: InputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;

  const lines = [
    "You are a trading assistant summarizing rule-based scan results.",
    "Return ONLY JSON that matches the schema.",
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

export async function generateAdvisorRecommendation(params: {
  apiKey: string;
  model: string;
  maxCompletionTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<AdvisorRecommendation> {
  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  const instructions = buildAdvisorInstructions(params.input as InputWithProfile);

  let response: unknown;

  try {
    response = await client.responses.parse({
      model: params.model,
      max_output_tokens: params.maxCompletionTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "medium" },
      instructions,
      input: JSON.stringify(params.input),
      text: {
        format: zodTextFormat(advisorRecommendationSchema, "advisor_recommendation")
      }
    });
  } catch (err) {
    throw formatOpenAIError(err, "generateAdvisorRecommendation");
  }

  // Check for incomplete response (common with reasoning models when token limit is too low)
  checkIncompleteResponse(response, "generateAdvisorRecommendation");

  const parsed = (response as { output_parsed?: AdvisorRecommendationOutput }).output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI response missing parsed output [generateAdvisorRecommendation]\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }

  return parseActionParams(parsed);
}

export async function generateSetupsSummary(params: {
  apiKey: string;
  model: string;
  maxCompletionTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<string> {
  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  const instructions = buildSetupsSummaryInstructions(params.input as InputWithProfile);

  let response: unknown;

  try {
    response = await client.responses.parse({
      model: params.model,
      max_output_tokens: params.maxCompletionTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "low" },
      instructions,
      input: JSON.stringify(params.input),
      text: {
        format: zodTextFormat(setupsSummarySchema, "setups_summary")
      }
    });
  } catch (err) {
    throw formatOpenAIError(err, "generateSetupsSummary");
  }

  // Check for incomplete response (common with reasoning models when token limit is too low)
  checkIncompleteResponse(response, "generateSetupsSummary");

  const parsed = (response as { output_parsed?: { summary: string } }).output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI response missing parsed output [generateSetupsSummary]\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }

  return parsed.summary;
}
