import type { FuturesPositionAnalysisResponse } from "@binance-advisor/shared";

import { formatNumber } from "./utils";

type Props = {
  deterministic: FuturesPositionAnalysisResponse["deterministic"];
};

export function DeterministicCard({ deterministic }: Props) {
  return (
    <div className="analysisCard">
      <div className="analysisTitle">Deterministic</div>
      <div className="analysisRow mono">
        TP: {deterministic.suggestedTakeProfit ? formatNumber(deterministic.suggestedTakeProfit, 2) : "-"}
      </div>
      <div className="analysisRow mono">
        SL: {deterministic.suggestedStopLoss ? formatNumber(deterministic.suggestedStopLoss, 2) : "-"}
      </div>
      {deterministic.warnings.length ? (
        <div className="analysisList">
          <div className="analysisLabel">Warnings</div>
          <ul>
            {deterministic.warnings.map((w, i) => (
              <li key={i} className="mono">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {deterministic.notes.length ? (
        <div className="analysisList">
          <div className="analysisLabel">Notes</div>
          <ul>
            {deterministic.notes.map((n, i) => (
              <li key={i} className="mono">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
