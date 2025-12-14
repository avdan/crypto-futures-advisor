import type { FuturesOpenOrder } from "@binance-advisor/shared";

import { formatNumber } from "./utils";

type Props = {
  orders: FuturesOpenOrder[];
  loading: boolean;
  selectedSymbol: string | null;
};

export function OpenOrdersTable({ orders, loading, selectedSymbol }: Props) {
  return (
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
                {loading ? "Loading..." : "No open orders for this symbol."}
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
  );
}
