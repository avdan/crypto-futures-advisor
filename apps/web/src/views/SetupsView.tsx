import { useCallback, useEffect, useMemo, useState } from "react";

import type { ScannerRunResponse, ScannerStatusResponse, SetupCandidate, Watchlist } from "@binance-advisor/shared";

import { fetchScannerResults, fetchScannerStatus, fetchWatchlist, runScanner, updateWatchlist } from "../api/scanner";

type Props = {
  apiBaseUrl: string;
  apiOnline: boolean;
};

function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

function parseSymbols(text: string): string[] {
  return text
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SetupsView({ apiBaseUrl, apiOnline }: Props) {
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [status, setStatus] = useState<ScannerStatusResponse | null>(null);
  const [results, setResults] = useState<ScannerRunResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [symbolsText, setSymbolsText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const topSetups = useMemo(() => (results?.results ?? []).slice(0, 20), [results]);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [w, s] = await Promise.all([
        fetchWatchlist(apiBaseUrl),
        fetchScannerStatus(apiBaseUrl)
      ]);
      setWatchlist(w);
      setStatus(s);
      setSymbolsText(w.symbols.join("\n"));

      try {
        const r = await fetchScannerResults(apiBaseUrl);
        setResults(r);
      } catch {
        setResults(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const onRunScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runScanner(apiBaseUrl);
      setResults(res);
      const s = await fetchScannerStatus(apiBaseUrl);
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const onSaveWatchlist = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const symbols = parseSymbols(symbolsText);
      const w = await updateWatchlist(apiBaseUrl, { symbols });
      setWatchlist(w);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save watchlist");
    } finally {
      setSaving(false);
    }
  }, [apiBaseUrl, symbolsText]);

  function SetupRow({ s }: { s: SetupCandidate }) {
    return (
      <tr>
        <td className="mono">{s.symbol}</td>
        <td className="mono">{s.timeframe}</td>
        <td>
          <span className={s.direction === "LONG" ? "badgeOk" : "badgeWarn"}>{s.direction}</span>
        </td>
        <td className="mono">{s.strategy}</td>
        <td className="right mono">{s.score}</td>
        <td className="right mono">
          {s.entryZone ? `${formatNumber(s.entryZone[0], 2)}–${formatNumber(s.entryZone[1], 2)}` : formatNumber(s.entry, 2)}
        </td>
        <td className="right mono">{formatNumber(s.stopLoss, 2)}</td>
        <td className="right mono">{formatNumber(s.takeProfit, 2)}</td>
        <td className="right mono">{s.rr ? formatNumber(s.rr, 2) : "-"}</td>
        <td className="right mono">{s.sizing ? formatNumber(s.sizing.quantity, 4) : "-"}</td>
        <td className="right mono pnlNeg">{s.sizing ? `$${formatNumber(s.sizing.riskUsd, 0)}` : "-"}</td>
        <td className="right mono pnlPos">{s.sizing ? `$${formatNumber(s.sizing.rewardUsd, 0)}` : "-"}</td>
        <td className="right mono">{s.sizing ? `${formatNumber(s.sizing.leverageRequired, 1)}x` : "-"}</td>
      </tr>
    );
  }

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Setup Scanner</div>
          <div className="panelSubtitle mono">
            {status?.running ? "Running…" : "Idle"} · Last: {status?.lastRunAt ?? "-"} · Next:{" "}
            {status?.nextRunAt ?? "-"}
          </div>
        </div>

        <div className="panelActions">
          <button className="button" onClick={() => void refreshAll()}>
            Refresh
          </button>
          <button className="button" onClick={() => void onRunScan()} disabled={loading}>
            {loading ? "Scanning…" : "Run scan now"}
          </button>
        </div>
      </div>

      {!apiOnline ? (
        <div className="warnBox">
          API appears offline. Start `apps/api` and ensure `VITE_API_BASE_URL` is correct.
        </div>
      ) : null}

      {error ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{error}</div>
        </div>
      ) : null}

      <div className="divider" />

      <div className="panelHeader">
        <div>
          <div className="panelTitle">Watchlist</div>
          <div className="panelSubtitle mono">
            {watchlist ? `${watchlist.symbols.length} symbols · Updated: ${watchlist.updatedAt}` : "Loading…"}
          </div>
        </div>

        <div className="panelActions">
          <button className="button" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          {editing ? (
            <button className="button" onClick={() => void onSaveWatchlist()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            className="textArea"
            value={symbolsText}
            onChange={(e) => setSymbolsText(e.target.value)}
            rows={10}
            spellCheck={false}
          />
          {saveError ? (
            <div className="errorBox">
              <div className="errorTitle">Save Error</div>
              <div className="mono">{saveError}</div>
            </div>
          ) : null}
          <div className="hint mono">One symbol per line (or comma-separated).</div>
        </div>
      ) : (
        <div className="chips">
          {(watchlist?.symbols ?? []).map((s) => (
            <span key={s} className="chip mono">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="divider" />

      <div className="panelHeader">
        <div>
          <div className="panelTitle">Top Setups</div>
          <div className="panelSubtitle mono">
            {results?.runAt ? `Scan: ${results.runAt}` : "No scan yet"}
            {results?.errors?.length ? ` · Errors: ${results.errors.length}` : ""}
          </div>
        </div>
      </div>

      {results?.llm.providers?.length ? (
        <div className="analysisGrid">
          {results.llm.providers.map((p) => {
            const title = p.provider === "openai" ? "OpenAI" : "Claude";
            return (
              <div key={p.provider} className="analysisCard">
                <div className="analysisTitle">{title} Summary (Top 3)</div>
                <div className="hint mono">
                  {p.enabled ? "Enabled" : "Disabled"}
                  {p.model ? ` · ${p.model}` : ""}
                  {typeof p.latencyMs === "number" ? ` · ${p.latencyMs}ms` : ""}
                </div>

                {!p.enabled ? (
                  <div className="hint mono">Missing API key on the server.</div>
                ) : p.error ? (
                  <div className="errorBox">
                    <div className="errorTitle">{title} Error</div>
                    <div className="mono">{p.error}</div>
                  </div>
                ) : p.output ? (
                  <div className="mono summaryText">{p.output}</div>
                ) : (
                  <div className="hint mono">No summary returned.</div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {results?.errors?.length ? (
        <div className="warnBox">
          <div className="errorTitle">Scan errors</div>
          <ul>
            {results.errors.slice(0, 8).map((e, i) => (
              <li key={i} className="mono">
                {e.symbol}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>TF</th>
              <th>Dir</th>
              <th>Strategy</th>
              <th className="right">Score</th>
              <th className="right">Entry</th>
              <th className="right">SL</th>
              <th className="right">TP</th>
              <th className="right">R:R</th>
              <th className="right">Qty</th>
              <th className="right">Risk $</th>
              <th className="right">Reward $</th>
              <th className="right">Lev</th>
            </tr>
          </thead>
          <tbody>
            {topSetups.length === 0 ? (
              <tr>
                <td colSpan={13} className="emptyCell">
                  Run a scan to see setups.
                </td>
              </tr>
            ) : (
              topSetups.map((s) => <SetupRow key={`${s.symbol}:${s.timeframe}:${s.strategy}`} s={s} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
