import { useCallback, useEffect, useMemo, useState } from "react";

import type { HealthzResponse } from "@binance-advisor/shared";
import { fetchHealthz } from "./api/health";
import { DashboardView } from "./views/DashboardView";
import { PositionsView } from "./views/PositionsView";
import { SetupsView } from "./views/SetupsView";
import "./styles.css";

type UiStatus = "checking" | "online" | "offline";
type Tab = "dashboard" | "positions" | "setups";

export function App() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001",
    []
  );

  const [uiStatus, setUiStatus] = useState<UiStatus>("checking");
  const [health, setHealth] = useState<HealthzResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  const refresh = useCallback(async () => {
    setLastCheckedAt(new Date().toISOString());

    try {
      const next = await fetchHealthz(apiBaseUrl);
      setHealth(next);
      setUiStatus("online");
      setError(null);
    } catch (err) {
      setUiStatus("offline");
      setHealth(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Binance Advisor</h1>
          <p className="subtle">MVP: status + Binance Futures positions (read-only)</p>
        </div>

        <div className="headerRight">
          <div className="statusPill" title={error ?? undefined}>
            <span
              className={`dot ${
                uiStatus === "online"
                  ? "dotOnline"
                  : uiStatus === "offline"
                    ? "dotOffline"
                    : "dotChecking"
              }`}
              aria-hidden
            />
            <span className="statusText">
              {uiStatus === "online"
                ? "Online"
                : uiStatus === "offline"
                  ? "Offline"
                  : "Checking"}
            </span>
          </div>

          <button className="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === "dashboard" ? "tabActive" : ""}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`tab ${tab === "positions" ? "tabActive" : ""}`}
          onClick={() => setTab("positions")}
        >
          Positions
        </button>
        <button
          className={`tab ${tab === "setups" ? "tabActive" : ""}`}
          onClick={() => setTab("setups")}
        >
          Setups
        </button>
      </nav>

      {tab === "dashboard" ? (
        <DashboardView
          apiBaseUrl={apiBaseUrl}
          health={health}
          lastCheckedAt={lastCheckedAt}
          error={error}
        />
      ) : tab === "positions" ? (
        <PositionsView apiBaseUrl={apiBaseUrl} apiOnline={uiStatus === "online"} />
      ) : (
        <SetupsView apiBaseUrl={apiBaseUrl} apiOnline={uiStatus === "online"} />
      )}
    </div>
  );
}
