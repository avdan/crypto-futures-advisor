import type {
  AltBtcCandleData,
  BtcCandleData,
  CalculatedEquityTargets,
  RawCandleData,
  UserTradingProfile
} from "@binance-advisor/shared";

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
  candles?: RawCandleData;
  // v3: BTC context candles (for ALT analysis)
  btc_candles?: BtcCandleData;
  altbtc_candles?: AltBtcCandleData;
  [key: string]: unknown;
};

export function buildAdvisorSystemPrompt(input: LlmInputWithProfile): string {
  const profile = input.userProfile;
  const userContext = input.userContext;
  const account = input.account;
  const equityTargets = input.calculated_equity_targets;
  const hasMultiTimeframe = Boolean(input.multi_timeframe_indicators);
  const hasCandles = input.candles && (
    (input.candles.m15?.length ?? 0) > 0 ||
    (input.candles.h1?.length ?? 0) > 0 ||
    (input.candles.h4?.length ?? 0) > 0 ||
    (input.candles.d1?.length ?? 0) > 0
  );
  const hasBtcCandles = input.btc_candles && (
    (input.btc_candles.h4?.length ?? 0) > 0 ||
    (input.btc_candles.d1?.length ?? 0) > 0
  );
  const hasAltBtcCandles = input.altbtc_candles && (
    (input.altbtc_candles.h4?.length ?? 0) > 0 ||
    (input.altbtc_candles.d1?.length ?? 0) > 0
  );

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
    "## CONFIDENCE SCORING (0-100 SCALE)",
    "Provide a confidence score from 0-100:",
    "- 80-100: Very High - Strong multi-timeframe alignment, clear structure, high conviction",
    "- 60-79: High - Good structure alignment with minor concerns",
    "- 40-59: Moderate - Mixed signals, some structural ambiguity",
    "- 20-39: Low - Conflicting signals, structure unclear",
    "- 0-19: Very Low - High uncertainty, structure broken or undeterminable",
    "",
    "Always provide 'what_would_change_mind' (1-3 conditions that would flip your view)",
    "Always provide 'drivers' array explaining what factors contribute to your confidence score",
    "",
    "## ANTI-PANIC RULES",
    "1. A 1-2% move against the position is NOT cause for alarm unless structure breaks",
    "2. Red candles after green runs are normal pullbacks, not reversals, unless key levels break",
    "3. Weekend moves have 50% lower weight in confidence scoring",
    "4. Liquidation wicks that recover immediately are BULLISH for the prevailing trend",
    "5. Do NOT recommend closing profitable positions just because they are profitable",
    "6. Drawdown from peak is NOT the same as a broken trade thesis",
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

  if (hasCandles) {
    lines.push("## RAW CANDLE DATA PROVIDED");
    lines.push("You have access to raw OHLCV candles across 4 timeframes in the input:");
    lines.push("- candles.d1: Daily candles (15 most recent) - PRIMARY for trend direction");
    lines.push("- candles.h4: 4-hour candles (25 most recent) - for swing structure");
    lines.push("- candles.h1: 1-hour candles (40 most recent) - for intraday structure");
    lines.push("- candles.m15: 15-minute candles (50 most recent) - for entry/exit timing");
    lines.push("");
    lines.push("Each candle: { t: timestamp, o: open, h: high, l: low, c: close, v: volume }");
    lines.push("Use this raw data to identify:");
    lines.push("- Key support/resistance levels (swing highs/lows)");
    lines.push("- Volume patterns (accumulation/distribution)");
    lines.push("- Candle patterns (engulfing, doji, hammer, etc.)");
    lines.push("- Trend structure (higher highs/lows or lower highs/lows)");
    lines.push("");
  }

  if (hasMultiTimeframe) {
    lines.push("## MULTI-TIMEFRAME ANALYSIS");
    lines.push("- Daily and 4H define the higher timeframe bias (populate higher_timeframe_bias)");
    lines.push("- 1H and 15m define lower timeframe behavior (populate lower_timeframe_behavior)");
    lines.push("- Describe what each timeframe shows behaviorally, not just indicator values");
    lines.push("");
  }

  if (hasBtcCandles) {
    const btc = input.btc_candles!;
    lines.push("## BTC CONTEXT REQUIREMENT");
    lines.push("For this ALT/USDT analysis, you MUST analyze BTCUSDT as market regime context.");
    lines.push("BTC analysis must be lightweight and structured, not a full report.");
    lines.push("");
    lines.push("BTC candle data provided:");
    lines.push(`- btc_candles.h4: ${btc.h4?.length ?? 0} candles (4-hour)`);
    lines.push(`- btc_candles.d1: ${btc.d1?.length ?? 0} candles (daily)`);
    if (btc.w1 && btc.w1.length > 0) {
      lines.push(`- btc_candles.w1: ${btc.w1.length} candles (weekly, derived from daily)`);
    }
    lines.push("");
    lines.push("Required BTC outputs (btc_context field):");
    lines.push("- regime: risk_on | risk_off | chop");
    lines.push("- bias: bullish | neutral | bearish");
    lines.push("- volatility: high | normal | low (based on ATR/candle ranges)");
    lines.push("- key_levels: { support: [S1, S2], resistance: [R1, R2] } - 2 of each");
    lines.push("- driver_flag: btc_driving | alt_idiosyncratic");
    lines.push("- impact_on_alt: 1-3 sentences on how BTC affects ALT probabilities");
    lines.push("");
    lines.push("Decision rule: BTC adjusts scenario probabilities, does NOT override ALT structure.");
    lines.push("- risk_off or high volatility: increase downside wick probability");
    lines.push("- risk_on: increase ALT continuation only if ALT structure agrees");
    lines.push("- chop: treat ALT moves as more likely idiosyncratic");
    lines.push("");
  }

  if (hasAltBtcCandles) {
    const altbtc = input.altbtc_candles!;
    lines.push("## ALTBTC RELATIVE STRENGTH");
    lines.push(`ALTBTC candles provided for ${altbtc.symbol} relative strength assessment.`);
    lines.push("");
    lines.push(`ALTBTC candle data: h4 (${altbtc.h4?.length ?? 0}), d1 (${altbtc.d1?.length ?? 0})`);
    lines.push("");
    lines.push("Required ALTBTC outputs (altbtc_context field):");
    lines.push("- symbol: the ALTBTC pair being analyzed");
    lines.push("- relative_strength: outperforming | neutral | underperforming vs BTC");
    lines.push("- structure: describe ALTBTC price action (HLs, LLs, key MA position)");
    lines.push("- implication: 1-2 sentences on how this affects runner management");
    lines.push("");
    lines.push("Interpretation:");
    lines.push("- ALTBTC making LLs / below key MAs: reduce extension probability");
    lines.push("- ALTBTC holding structure / making HLs: favor holding runners");
    lines.push("- ALTBTC does NOT override ALTUSDT execution or invalidation levels");
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
  const hasBtcCandles = input.btc_candles && (
    (input.btc_candles.h4?.length ?? 0) > 0 ||
    (input.btc_candles.d1?.length ?? 0) > 0
  );

  const lines = [
    "You are a trading assistant summarizing rule-based scan results.",
    "Write a compact summary of the top setups with clear entry/stop/TP and key invalidation.",
    "Do not add disclaimers.",
    ""
  ];

  if (hasBtcCandles) {
    const btc = input.btc_candles!;
    lines.push("## BTC MARKET CONTEXT");
    lines.push("BTC candle data is provided for macro context when evaluating ALT setups.");
    lines.push(`- BTC 4H: ${btc.h4?.length ?? 0} candles`);
    lines.push(`- BTC 1D: ${btc.d1?.length ?? 0} candles`);
    lines.push("");
    lines.push("Consider BTC regime when ranking setup quality:");
    lines.push("- risk_on: favor continuation and breakout setups");
    lines.push("- risk_off: be cautious with LONG setups, favor SHORT or skip");
    lines.push("- chop: reduce conviction on all setups");
    lines.push("");
  }

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
