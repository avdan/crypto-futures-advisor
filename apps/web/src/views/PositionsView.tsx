import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AdvisorAction,
  CreateOrderPlanDraftResponse,
  FuturesOpenOrder,
  FuturesPosition,
  FuturesPositionAnalysisResponse,
  LlmProviderId
} from "@binance-advisor/shared";
import { analyzeFuturesPosition } from "../api/analysis";
import { fetchFuturesOpenOrders, fetchFuturesPositions } from "../api/futures";
import { createOrderPlanDraft } from "../api/orderPlan";

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

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function positionDirection(position: FuturesPosition): "LONG" | "SHORT" | "FLAT" {
  if (position.positionSide === "LONG") return "LONG";
  if (position.positionSide === "SHORT") return "SHORT";
  if (position.amount > 0) return "LONG";
  if (position.amount < 0) return "SHORT";
  return "FLAT";
}

export function PositionsView({ apiBaseUrl, apiOnline }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [positions, setPositions] = useState<FuturesPosition[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersFetchedAt, setOrdersFetchedAt] = useState<string | null>(null);
  const [orders, setOrders] = useState<FuturesOpenOrder[]>([]);

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FuturesPositionAnalysisResponse | null>(null);
  const [selectedActionKeys, setSelectedActionKeys] = useState<Record<string, boolean>>({});

  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CreateOrderPlanDraftResponse | null>(null);

  const nonZeroOnly = true;
  const autoRefreshDefault = false;
  const [autoRefresh, setAutoRefresh] = useState(autoRefreshDefault);
  const refreshMs = 15_000;

  const refreshPositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFuturesPositions(apiBaseUrl, { nonZero: nonZeroOnly });
      setPositions(res.positions);
      setFetchedAt(res.fetchedAt);
    } catch (err) {
      setPositions([]);
      setFetchedAt(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const refreshOrders = useCallback(
    async (symbol: string) => {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const res = await fetchFuturesOpenOrders(apiBaseUrl, symbol);
        setOrders(res.orders);
        setOrdersFetchedAt(res.fetchedAt);
      } catch (err) {
        setOrders([]);
        setOrdersFetchedAt(null);
        setOrdersError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setOrdersLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    void refreshPositions();
  }, [refreshPositions]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => void refreshPositions(), refreshMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, refreshPositions]);

  useEffect(() => {
    if (!selectedSymbol) return;
    void refreshOrders(selectedSymbol);
    setAnalysis(null);
    setAnalysisError(null);
    setSelectedActionKeys({});
    setPlan(null);
    setPlanError(null);
  }, [refreshOrders, selectedSymbol]);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.symbol === selectedSymbol) ?? null,
    [positions, selectedSymbol]
  );

  const runAnalysis = useCallback(async () => {
    if (!selectedSymbol) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const res = await analyzeFuturesPosition(apiBaseUrl, { symbol: selectedSymbol });
      setAnalysis(res);
      setSelectedActionKeys({});
      setPlan(null);
      setPlanError(null);
    } catch (err) {
      setAnalysis(null);
      setAnalysisError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalysisLoading(false);
    }
  }, [apiBaseUrl, selectedSymbol]);

  const selectedSelections = useMemo(() => {
    if (!analysis) return [];
    const out: Array<{ provider: LlmProviderId; action: AdvisorAction }> = [];

    for (const provider of analysis.llm.providers) {
      if (!provider.output) continue;
      provider.output.actions.forEach((action, index) => {
        const key = `${provider.provider}:${index}`;
        if (selectedActionKeys[key]) {
          out.push({ provider: provider.provider, action });
        }
      });
    }

    return out;
  }, [analysis, selectedActionKeys]);

  const buildPlan = useCallback(async () => {
    if (!selectedSymbol) return;
    if (selectedSelections.length === 0) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await createOrderPlanDraft(apiBaseUrl, {
        symbol: selectedSymbol,
        selections: selectedSelections
      });
      setPlan(res);
    } catch (err) {
      setPlan(null);
      setPlanError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPlanLoading(false);
    }
  }, [apiBaseUrl, selectedSelections, selectedSymbol]);

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Futures Positions</div>
          <div className="panelSubtitle mono">
            {fetchedAt ? `Fetched: ${fetchedAt}` : "Not fetched yet"}
          </div>
        </div>

        <div className="panelActions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="toggleText mono">Auto refresh (15s)</span>
          </label>

          <button className="button" onClick={() => void refreshPositions()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
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

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th className="right">Amt</th>
              <th className="right">Entry</th>
              <th className="right">Mark</th>
              <th className="right">UPnL</th>
              <th className="right">Lev</th>
              <th className="right">Liq</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={9} className="emptyCell">
                  {loading ? "Loading…" : "No open positions."}
                </td>
              </tr>
            ) : (
              positions.map((p) => {
                const dir = positionDirection(p);
                const active = p.symbol === selectedSymbol;
                return (
                  <tr
                    key={`${p.symbol}:${p.positionSide}`}
                    className={active ? "rowActive" : undefined}
                    onClick={() => setSelectedSymbol(p.symbol)}
                  >
                    <td className="mono">{p.symbol}</td>
                    <td>
                      <span className={dir === "LONG" ? "badgeOk" : "badgeWarn"}>{dir}</span>
                    </td>
                    <td className="right mono">{formatNumber(p.amount, 6)}</td>
                    <td className="right mono">{formatNumber(p.entryPrice, 2)}</td>
                    <td className="right mono">{formatNumber(p.markPrice, 2)}</td>
                    <td className={`right mono ${p.unrealizedPnl >= 0 ? "pnlPos" : "pnlNeg"}`}>
                      {formatMoney(p.unrealizedPnl)}
                    </td>
                    <td className="right mono">{formatNumber(p.leverage, 0)}x</td>
                    <td className="right mono">
                      {p.liquidationPrice ? formatNumber(p.liquidationPrice, 2) : "-"}
                    </td>
                    <td className="mono">{p.marginType}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="divider" />

      <div className="panelHeader">
        <div>
          <div className="panelTitle">Open Orders</div>
          <div className="panelSubtitle mono">
            {selectedSymbol ? `Symbol: ${selectedSymbol}` : "Select a position"}
            {ordersFetchedAt ? ` · Fetched: ${ordersFetchedAt}` : ""}
          </div>
        </div>

        <div className="panelActions">
          <button
            className="button"
            onClick={() => void runAnalysis()}
            disabled={!selectedSymbol || analysisLoading}
            title="Runs deterministic checks and (optionally) OpenAI analysis"
          >
            {analysisLoading ? "Analyzing…" : "Analyze"}
          </button>
          <button
            className="button"
            onClick={() => selectedSymbol && void refreshOrders(selectedSymbol)}
            disabled={!selectedSymbol || ordersLoading}
          >
            {ordersLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {selectedPosition?.updatedAt ? (
        <div className="hint mono">Position updated: {selectedPosition.updatedAt}</div>
      ) : null}

      {ordersError ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{ordersError}</div>
        </div>
      ) : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Side</th>
              <th className="right">Price</th>
              <th className="right">Qty</th>
              <th className="right">Exec</th>
              <th className="right">Stop</th>
              <th>Status</th>
              <th>Reduce</th>
            </tr>
          </thead>
          <tbody>
            {!selectedSymbol ? (
              <tr>
                <td colSpan={8} className="emptyCell">
                  Select a position above to load open orders.
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="emptyCell">
                  {ordersLoading ? "Loading…" : "No open orders for this symbol."}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={String(o.orderId)}>
                  <td className="mono">{o.type}</td>
                  <td className="mono">
                    {o.side} {o.positionSide !== "BOTH" ? `(${o.positionSide})` : ""}
                  </td>
                  <td className="right mono">{formatNumber(o.price, 2)}</td>
                  <td className="right mono">{formatNumber(o.origQty, 6)}</td>
                  <td className="right mono">{formatNumber(o.executedQty, 6)}</td>
                  <td className="right mono">{o.stopPrice ? formatNumber(o.stopPrice, 2) : "-"}</td>
                  <td className="mono">{o.status}</td>
                  <td className="mono">{o.reduceOnly ? "yes" : "no"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="divider" />

      <div className="panelHeader">
        <div>
          <div className="panelTitle">Analysis</div>
          <div className="panelSubtitle mono">
            {analysis?.fetchedAt ? `Fetched: ${analysis.fetchedAt}` : "Run analysis to see recommendations"}
          </div>
        </div>
      </div>

      {analysisError ? (
        <div className="errorBox">
          <div className="errorTitle">Error</div>
          <div className="mono">{analysisError}</div>
        </div>
      ) : null}

      {!analysis ? (
        <div className="hint mono">
          This is advisory only. Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in `apps/api/.env` to enable LLM recommendations.
        </div>
      ) : (
        <div className="analysisGrid">
          <div className="analysisCard">
            <div className="analysisTitle">Deterministic</div>
            <div className="analysisRow mono">
              TP:{" "}
              {analysis.deterministic.suggestedTakeProfit
                ? formatNumber(analysis.deterministic.suggestedTakeProfit, 2)
                : "-"}
            </div>
            <div className="analysisRow mono">
              SL:{" "}
              {analysis.deterministic.suggestedStopLoss
                ? formatNumber(analysis.deterministic.suggestedStopLoss, 2)
                : "-"}
            </div>
            {analysis.deterministic.warnings.length ? (
              <div className="analysisList">
                <div className="analysisLabel">Warnings</div>
                <ul>
                  {analysis.deterministic.warnings.map((w, i) => (
                    <li key={i} className="mono">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {analysis.deterministic.notes.length ? (
              <div className="analysisList">
                <div className="analysisLabel">Notes</div>
                <ul>
                  {analysis.deterministic.notes.map((n, i) => (
                    <li key={i} className="mono">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {analysis.llm.providers.map((p) => {
            const title = p.provider === "openai" ? "OpenAI" : "Claude";
            const keyPrefix = p.provider;

            return (
              <div key={p.provider} className="analysisCard">
                <div className="analysisTitle">{title}</div>
                <div className="analysisMeta mono">
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
                ) : !p.output ? (
                  <div className="hint mono">No recommendation returned.</div>
                ) : (
                  <>
                    <div className="analysisRow">
                      <span className="analysisLabel">Summary</span>
                      <span className="mono">
                        Confidence: {Math.round(p.output.confidence * 100)}%
                      </span>
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
                                onChange={(e) =>
                                  setSelectedActionKeys((prev) => ({
                                    ...prev,
                                    [actionKey]: e.target.checked
                                  }))
                                }
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
          })}
        </div>
      )}

      {analysis ? (
        <>
          <div className="divider" />

          <div className="panelHeader">
            <div>
              <div className="panelTitle">Order Plan Draft</div>
              <div className="panelSubtitle mono">
                Selected actions: {selectedSelections.length}
              </div>
            </div>
            <div className="panelActions">
              <button
                className="button"
                disabled={!selectedSymbol || selectedSelections.length === 0 || planLoading}
                onClick={() => void buildPlan()}
              >
                {planLoading ? "Building…" : "Build plan"}
              </button>
            </div>
          </div>

          {planError ? (
            <div className="errorBox">
              <div className="errorTitle">Error</div>
              <div className="mono">{planError}</div>
            </div>
          ) : null}

          {plan?.warnings?.length ? (
            <div className="warnBox">
              <div className="errorTitle">Warnings</div>
              <ul>
                {plan.warnings.map((w, i) => (
                  <li key={i} className="mono">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan ? (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.steps.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="emptyCell">
                        No steps generated.
                      </td>
                    </tr>
                  ) : (
                    plan.steps.map((s, i) => (
                      <tr key={i}>
                        <td className="mono">{s.kind}</td>
                        <td className="mono">
                          {s.kind === "NOTE"
                            ? s.text
                            : s.kind === "CANCEL_ORDER"
                              ? `${s.symbol} · orderId=${s.orderId} · ${s.reason}`
                              : `${s.symbol} · ${s.order.type} ${s.order.side} · qty=${s.order.quantity ?? "close"} · price=${s.order.price ?? "-"} · stop=${s.order.stopPrice ?? "-"} · reduceOnly=${s.order.reduceOnly} · ${s.reason}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="hint mono">
              Select actions above (from OpenAI or Claude) then click “Build plan”.
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
