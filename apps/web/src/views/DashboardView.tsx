import type { HealthzResponse } from "@binance-advisor/shared";

type Props = {
  apiBaseUrl: string;
  health: HealthzResponse | null;
  lastCheckedAt: string | null;
  error: string | null;
};

export function DashboardView({ apiBaseUrl, health, lastCheckedAt, error }: Props) {
  const ping = health?.binance.ping;

  return (
    <section className="card">
      <div className="row">
        <div className="label">API Base URL</div>
        <div className="value mono">{apiBaseUrl}</div>
      </div>

      <div className="row">
        <div className="label">Last Checked</div>
        <div className="value mono">{lastCheckedAt ?? "-"}</div>
      </div>

      <div className="row">
        <div className="label">API Timestamp</div>
        <div className="value mono">{health?.timestamp ?? "-"}</div>
      </div>

      <div className="row">
        <div className="label">Binance Futures</div>
        <div className="value">
          <span className={health?.binance.configured ? "badgeOk" : "badgeWarn"}>
            {health?.binance.configured ? "Configured" : "Not configured"}
          </span>
          <span
            className={
              ping?.status === "ok"
                ? "badgeOk"
                : ping?.status === "error"
                  ? "badgeErr"
                  : "badgeWarn"
            }
            title={ping?.error ?? undefined}
          >
            {ping?.status === "ok"
              ? `Ping ok${typeof ping.latencyMs === "number" ? ` (${ping.latencyMs}ms)` : ""}`
              : ping?.status === "error"
                ? "Ping error"
                : "Ping unknown"}
          </span>
          <span className="mono">{health?.binance.futuresBaseUrl ?? "-"}</span>
        </div>
      </div>

      <div className="row">
        <div className="label">OpenAI</div>
        <div className="value">
          <span className={health?.openai.configured ? "badgeOk" : "badgeWarn"}>
            {health?.openai.configured ? "Configured" : "Not configured"}
          </span>
          {health?.openai.model ? <span className="mono">{health.openai.model}</span> : null}
          {typeof health?.openai.maxCompletionTokens === "number" ? (
            <span className="mono">max_completion_tokens={health.openai.maxCompletionTokens}</span>
          ) : null}
        </div>
      </div>

      <div className="row">
        <div className="label">Claude</div>
        <div className="value">
          <span className={health?.anthropic.configured ? "badgeOk" : "badgeWarn"}>
            {health?.anthropic.configured ? "Configured" : "Not configured"}
          </span>
          {health?.anthropic.model ? <span className="mono">{health.anthropic.model}</span> : null}
          {typeof health?.anthropic.maxTokens === "number" ? (
            <span className="mono">max_tokens={health.anthropic.maxTokens}</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{error}</div>
        </div>
      ) : null}
    </section>
  );
}
