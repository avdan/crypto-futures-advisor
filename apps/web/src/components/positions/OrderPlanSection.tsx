import type { CreateOrderPlanDraftResponse } from "@binance-advisor/shared";

type Props = {
  plan: CreateOrderPlanDraftResponse | null;
  planLoading: boolean;
  planError: string | null;
  selectedCount: number;
  canBuild: boolean;
  onBuildPlan: () => void;
};

export function OrderPlanSection({
  plan,
  planLoading,
  planError,
  selectedCount,
  canBuild,
  onBuildPlan
}: Props) {
  return (
    <>
      <div className="divider" />

      <div className="panelHeader">
        <div>
          <div className="panelTitle">Order Plan Draft</div>
          <div className="panelSubtitle mono">Selected actions: {selectedCount}</div>
        </div>
        <div className="panelActions">
          <button className="button" disabled={!canBuild || planLoading} onClick={onBuildPlan}>
            {planLoading ? "Building..." : "Build plan"}
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
                          ? `${s.symbol} - orderId=${s.orderId} - ${s.reason}`
                          : `${s.symbol} - ${s.order.type} ${s.order.side} - qty=${s.order.quantity ?? "close"} - price=${s.order.price ?? "-"} - stop=${s.order.stopPrice ?? "-"} - reduceOnly=${s.order.reduceOnly} - ${s.reason}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hint mono">Select actions above (from OpenAI or Claude) then click "Build plan".</div>
      )}
    </>
  );
}
