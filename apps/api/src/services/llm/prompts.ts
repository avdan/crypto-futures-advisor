import type { CalculatedEquityTargets, UserTradingProfile } from "@binance-advisor/shared";

export type LlmInputWithProfile = {
  userProfile?: UserTradingProfile;
  userContext?: string | null;
  account?: {
    wallet_equity: number;
    target_return_equity_percent: number;
    stretch_return_equity_percent: number[];
  };
  calculated_equity_targets?: CalculatedEquityTargets;
  multi_timeframe_indicators?: unknown;
  [key: string]: unknown;
};

export function buildAdvisorSystemPrompt(input: LlmInputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;
  const account = input.account;
  const equityTargets = input.calculated_equity_targets;
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

  if (equityTargets) {
    lines.push("## EQUITY TARGETS (PRE-CALCULATED)");
    lines.push(`- Position: ${equityTargets.direction} from $${equityTargets.entry_price.toFixed(2)}`);
    lines.push(`- Wallet equity: $${equityTargets.wallet_equity.toFixed(2)}`);
    lines.push("");
    lines.push(`### Minimum Target (${equityTargets.minimum_target.percent}% equity return)`);
    lines.push(`- Profit required: $${equityTargets.minimum_target.profit_required.toFixed(2)}`);
    lines.push(`- Required price: $${equityTargets.minimum_target.required_price.toFixed(2)}`);
    lines.push("");
    lines.push("### Stretch Targets");
    for (const target of equityTargets.stretch_targets) {
      lines.push(`- ${target.percent}% equity return: $${target.required_price.toFixed(2)} (profit: $${target.profit_required.toFixed(2)})`);
    }
    lines.push("");
    lines.push("TASK: Assess if each target price is REACHABLE based on current structure.");
    lines.push("- Set reachable=true if structure supports the move, false if invalidated or unrealistic");
    lines.push("- Use the pre-calculated required_price values in your equity_potential output");
    lines.push("");
  } else if (account) {
    lines.push("## EQUITY CONTEXT");
    lines.push(`- Current wallet equity: $${account.wallet_equity.toFixed(2)}`);
    lines.push(`- Target: ${account.target_return_equity_percent}% equity return`);
    lines.push(`- Stretch targets: ${account.stretch_return_equity_percent.join("%, ")}% equity returns`);
    lines.push("- No position data available to calculate exact price levels");
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

  return lines.join("\n").trim();
}

export function buildSetupsSummarySystemPrompt(input: LlmInputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;

  const lines = [
    "You are a trading assistant summarizing rule-based scan results.",
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
