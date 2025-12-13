import { useCallback, useEffect, useMemo, useState } from "react";

import type { FuturesOpenOrder, FuturesPosition } from "@binance-advisor/shared";
import { fetchFuturesOpenOrders, fetchFuturesPositions } from "../api/futures";

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
  }, [refreshOrders, selectedSymbol]);

  const selectedPosition = useMemo(
    () => positions.find((p) => p.symbol === selectedSymbol) ?? null,
    [positions, selectedSymbol]
  );

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
    </section>
  );
}

