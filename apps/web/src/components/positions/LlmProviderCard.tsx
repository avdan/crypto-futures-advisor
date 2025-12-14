import type { AdvisorRecommendation, LlmProviderResult } from "@binance-advisor/shared";

import { formatNumber } from "./utils";

type Props = {
  provider: LlmProviderResult<AdvisorRecommendation>;
  selectedActionKeys: Record<string, boolean>;
  onToggleAction: (key: string, checked: boolean) => void;
};

export function LlmProviderCard({ provider: p, selectedActionKeys, onToggleAction }: Props) {
  const title = p.provider === "openai" ? "OpenAI" : "Claude";
  const keyPrefix = p.provider;

  return (
    <div className="analysisCard">
      <div className="analysisTitle">{title}</div>
      <div className="analysisMeta mono">
        {p.enabled ? "Enabled" : "Disabled"}
        {p.model ? ` - ${p.model}` : ""}
        {typeof p.latencyMs === "number" ? ` - ${p.latencyMs}ms` : ""}
      </div>

      {!p.enabled ? (
        <div className="hint mono">Missing API key on the server.</div>
      ) : p.error ? (
        <div className="errorBox">
          <div className="errorTitle">{title} Error</div>
          <div className="mono">{p.error}</div>
        </div>
      ) : !p.output ? (
        <div className="hint mono">No recommendation returned.</div>
      ) : (
        <>
          {/* Verdict (prominent box at top) */}
          {p.output.verdict ? <div className="verdictBox mono">{p.output.verdict}</div> : null}

          {/* Status badges row */}
          <div className="statusBadges">
            {p.output.trade_quality ? (
              <span
                className={`statusBadge ${
                  p.output.trade_quality.grade === "A"
                    ? "badgeOk"
                    : p.output.trade_quality.grade === "B"
                      ? "badgeNeutral"
                      : "badgeWarn"
                }`}
              >
                Grade {p.output.trade_quality.grade}
              </span>
            ) : null}
            {p.output.position_status ? (
              <span
                className={`statusBadge ${p.output.position_status === "VALID" ? "badgeOk" : "badgeWarn"}`}
              >
                {p.output.position_status}
              </span>
            ) : null}
            {p.output.trade_quality?.original_thesis_status ? (
              <span className="statusBadge badgeNeutral">
                Thesis: {p.output.trade_quality.original_thesis_status}
              </span>
            ) : null}
          </div>

          {/* Higher Timeframe Bias */}
          {p.output.higher_timeframe_bias ? (
            <div className="analysisSection">
              <div className="analysisLabel">Higher Timeframe Bias</div>
              <div className="biasRow">
                <span className="biasItem">
                  <span className="biasLabel">Daily:</span>
                  <span
                    className={`biasBadge ${
                      p.output.higher_timeframe_bias.daily === "bullish"
                        ? "badgeOk"
                        : p.output.higher_timeframe_bias.daily === "bearish"
                          ? "badgeWarn"
                          : "badgeNeutral"
                    }`}
                  >
                    {p.output.higher_timeframe_bias.daily}
                  </span>
                </span>
                <span className="biasItem">
                  <span className="biasLabel">4H:</span>
                  <span
                    className={`biasBadge ${
                      p.output.higher_timeframe_bias.h4 === "bullish"
                        ? "badgeOk"
                        : p.output.higher_timeframe_bias.h4 === "bearish"
                          ? "badgeWarn"
                          : "badgeNeutral"
                    }`}
                  >
                    {p.output.higher_timeframe_bias.h4}
                  </span>
                </span>
              </div>
            </div>
          ) : null}

          {/* Lower Timeframe Behavior */}
          {p.output.lower_timeframe_behavior ? (
            <div className="analysisSection">
              <div className="analysisLabel">Lower Timeframe Behavior</div>
              <div className="tfBehavior mono">
                <div>
                  <strong>1H:</strong> {p.output.lower_timeframe_behavior.h1}
                </div>
                <div>
                  <strong>15m:</strong> {p.output.lower_timeframe_behavior.m15}
                </div>
              </div>
            </div>
          ) : null}

          {/* Key Levels */}
          {p.output.key_levels ? (
            <div className="analysisSection">
              <div className="analysisLabel">Key Levels</div>
              <div className="keyLevels mono">
                {p.output.key_levels.invalidation.length > 0 ? (
                  <div>
                    <span className="levelLabel badgeWarn">Invalidation:</span>{" "}
                    {p.output.key_levels.invalidation.map((l) => formatNumber(l, 2)).join(", ")}
                  </div>
                ) : null}
                {p.output.key_levels.continuation.length > 0 ? (
                  <div>
                    <span className="levelLabel badgeOk">Continuation:</span>{" "}
                    {p.output.key_levels.continuation.map((l) => formatNumber(l, 2)).join(", ")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Scenarios */}
          {p.output.scenarios && p.output.scenarios.length > 0 ? (
            <div className="analysisSection">
              <div className="analysisLabel">Scenarios</div>
              <ul className="scenarioList">
                {p.output.scenarios.map((s, i) => (
                  <li key={i} className="scenarioItem">
                    <span className="scenarioProb mono">{Math.round(s.probability * 100)}%</span>
                    <span className="scenarioText">{s.scenario}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Equity Potential */}
          {p.output.equity_potential ? (
            <div className="analysisSection">
              <div className="analysisLabel">Equity Potential</div>
              <div className="equityPotential mono">
                <div>
                  <span
                    className={
                      p.output.equity_potential.minimum_target_10pct.reachable ? "pnlPos" : "pnlNeg"
                    }
                  >
                    10% target:{" "}
                    {p.output.equity_potential.minimum_target_10pct.reachable
                      ? "REACHABLE"
                      : "NOT REACHABLE"}
                  </span>
                  {p.output.equity_potential.minimum_target_10pct.required_price_level !== null ? (
                    <span>
                      {" "}
                      @ {formatNumber(p.output.equity_potential.minimum_target_10pct.required_price_level, 2)}
                    </span>
                  ) : null}
                </div>
                <div>
                  <span
                    className={
                      p.output.equity_potential.stretch_target_20_30pct.reachable ? "pnlPos" : "pnlNeg"
                    }
                  >
                    20-30% stretch:{" "}
                    {p.output.equity_potential.stretch_target_20_30pct.reachable
                      ? "REACHABLE"
                      : "NOT REACHABLE"}
                  </span>
                  {p.output.equity_potential.stretch_target_20_30pct.required_price_levels.length > 0 ? (
                    <span>
                      {" "}
                      @{" "}
                      {p.output.equity_potential.stretch_target_20_30pct.required_price_levels
                        .map((l) => formatNumber(l, 2))
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Management Guidance */}
          {p.output.management_guidance ? (
            <div className="analysisSection">
              <div className="analysisLabel">Management Guidance</div>
              <div className="managementGuidance">
                <span
                  className={`actionBadge ${
                    p.output.management_guidance.recommended_action === "HOLD"
                      ? "badgeOk"
                      : p.output.management_guidance.recommended_action === "PARTIAL_DERISK"
                        ? "badgeNeutral"
                        : "badgeWarn"
                  }`}
                >
                  {p.output.management_guidance.recommended_action}
                </span>
                <span className="guidanceRationale">{p.output.management_guidance.rationale}</span>
              </div>
            </div>
          ) : null}

          <div className="analysisRow">
            <span className="analysisLabel">Summary</span>
            <span className="mono">Confidence: {Math.round(p.output.confidence * 100)}%</span>
          </div>
          <div className="mono">{p.output.summary}</div>

          <div className="analysisRow">
            <span className="analysisLabel">Actions</span>
            <span className="mono">Select to build a plan</span>
          </div>
          <ul className="actionList">
            {p.output.actions.map((action, index) => {
              const actionKey = `${keyPrefix}:${index}`;
              const checked = Boolean(selectedActionKeys[actionKey]);
              return (
                <li key={actionKey} className="actionItem">
                  <label className="actionPick">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggleAction(actionKey, e.target.checked)}
                    />
                    <span className="mono">
                      {action.type}: {action.title}
                    </span>
                  </label>
                  <div className="subtle">{action.reason}</div>
                </li>
              );
            })}
          </ul>

          {p.output.invalidation.length ? (
            <>
              <div className="analysisRow">
                <span className="analysisLabel">Invalidation</span>
              </div>
              <ul>
                {p.output.invalidation.map((t, i) => (
                  <li key={i} className="subtle">
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
