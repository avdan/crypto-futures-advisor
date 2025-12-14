import type { AccountMarginInfo } from "@binance-advisor/shared";

import { formatMoney, formatNumber } from "./utils";

type Props = {
  marginInfo: AccountMarginInfo;
};

export function AccountMarginPanel({ marginInfo }: Props) {
  return (
    <>
      <div className="divider" />
      <div className="panelHeader">
        <div>
          <div className="panelTitle">Account Margin</div>
        </div>
      </div>
      <div className="marginInfoGrid">
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Margin Ratio</div>
          <div
            className={`marginInfoValue mono ${
              marginInfo.marginRatio > 50
                ? "pnlNeg"
                : marginInfo.marginRatio > 25
                  ? "pnlWarn"
                  : ""
            }`}
          >
            {formatNumber(marginInfo.marginRatio, 2)}%
          </div>
        </div>
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Maintenance Margin</div>
          <div className="marginInfoValue mono">${formatNumber(marginInfo.maintenanceMargin, 2)}</div>
        </div>
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Account Equity</div>
          <div className="marginInfoValue mono">${formatNumber(marginInfo.accountEquity, 2)}</div>
        </div>
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Position Value</div>
          <div className="marginInfoValue mono">${formatNumber(marginInfo.positionValue, 2)}</div>
        </div>
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Actual Leverage</div>
          <div className="marginInfoValue mono">{formatNumber(marginInfo.actualLeverage, 2)}x</div>
        </div>
        <div className="marginInfoItem">
          <div className="marginInfoLabel">Unrealized PnL</div>
          <div className={`marginInfoValue mono ${marginInfo.unrealizedPnl >= 0 ? "pnlPos" : "pnlNeg"}`}>
            {formatMoney(marginInfo.unrealizedPnl)}
          </div>
        </div>
      </div>
    </>
  );
}
