import type { FuturesPosition } from "@binance-advisor/shared";

import { formatMoney, formatNumber, positionDirection } from "./utils";

type Props = {
  positions: FuturesPosition[];
  loading: boolean;
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
};

export function PositionsTable({ positions, loading, selectedSymbol, onSelectSymbol }: Props) {
  return (
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
                {loading ? "Loading..." : "No open positions."}
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
                  onClick={() => onSelectSymbol(p.symbol)}
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
                  <td className="right mono">
                    {p.actualLeverage !== null
                      ? `${formatNumber(p.actualLeverage, 2)}x`
                      : `${formatNumber(p.leverage, 0)}x`}
                  </td>
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
  );
}
