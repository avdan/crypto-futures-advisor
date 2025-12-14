import { useCallback, useEffect, useMemo, useState } from "react";

import type { Alert } from "@binance-advisor/shared";

import { acknowledgeAlert, fetchAlerts } from "../api/alerts";

type Props = {
  apiBaseUrl: string;
  apiOnline: boolean;
};

function severityBadge(severity: Alert["severity"]) {
  if (severity === "CRITICAL") return "badgeErr";
  if (severity === "WARN") return "badgeWarn";
  return "badgeOk";
}

export function AlertsView({ apiBaseUrl, apiOnline }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [includeAcknowledged, setIncludeAcknowledged] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiOnline) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts(apiBaseUrl, { limit: 200, includeAcknowledged });
      setAlerts(res.alerts);
      setFetchedAt(res.fetchedAt);
    } catch (err) {
      setAlerts([]);
      setFetchedAt(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, apiOnline, includeAcknowledged]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const unackedCount = useMemo(() => alerts.filter((a) => !a.acknowledgedAt).length, [alerts]);

  const onAck = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await acknowledgeAlert(apiBaseUrl, id);
        setAlerts((prev) => prev.map((a) => (a.id === res.alert.id ? res.alert : a)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to acknowledge alert");
      }
    },
    [apiBaseUrl]
  );

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Alerts</div>
          <div className="panelSubtitle mono">
            {fetchedAt ? `Fetched: ${fetchedAt}` : "No fetch yet"} · Unacked: {unackedCount}
          </div>
        </div>

        <div className="panelActions">
          <label className="toggle mono">
            <input
              type="checkbox"
              checked={includeAcknowledged}
              onChange={(e) => setIncludeAcknowledged(e.target.checked)}
            />
            Show acknowledged
          </label>
          <button className="button" onClick={() => void refresh()} disabled={!apiOnline || loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {!apiOnline ? <div className="hint mono">API offline.</div> : null}

      {error ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{error}</div>
        </div>
      ) : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Severity</th>
              <th>Type</th>
              <th>Symbol</th>
              <th>Title</th>
              <th>Message</th>
              <th className="right">Ack</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="emptyCell">
                  {loading ? "Loading…" : "No alerts yet."}
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className={a.acknowledgedAt ? "rowMuted" : undefined}>
                  <td className="mono">{a.createdAt}</td>
                  <td>
                    <span className={severityBadge(a.severity)}>{a.severity}</span>
                  </td>
                  <td className="mono">{a.type}</td>
                  <td className="mono">{a.symbol ?? "-"}</td>
                  <td>{a.title}</td>
                  <td className="mono" style={{ whiteSpace: "pre-wrap" }}>
                    {a.message}
                  </td>
                  <td className="right">
                    {a.acknowledgedAt ? (
                      <span className="mono">—</span>
                    ) : (
                      <button className="button" onClick={() => void onAck(a.id)}>
                        Ack
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

