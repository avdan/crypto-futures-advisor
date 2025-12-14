# Advisor v2: Schema + Confidence Scoring + Winner Management (MD)

This document defines:
1) A JSON schema v2 you can send to your advisor (Binance-connected).
2) A confidence scoring model for “is this trade working?” that avoids panic.
3) A winner-management framework that targets 10% wallet equity, with stretch to 20–30%.

---

## 1) JSON Schema v2 (lean, structure-first)

### 1.1 Payload overview
- Send position + account + constraints + candles (OHLCV).
- Keep indicators optional. Candles are the backbone.
- Use 4 timeframes as default: m15, h1, h4, d1.

### 1.2 Recommended candle depth
- m15: 50 candles
- h1: 40 candles
- h4: 25 candles
- d1: 15 candles

Total: 130 candles.

### 1.3 Canonical payload
```json
{
  "meta": {
    "asOf": "2025-12-14T23:10:00+08:00",
    "source": "binance_futures",
    "advisorModel": "gpt-5-mini",
    "version": "advisor_v2"
  },

  "account": {
    "walletEquity": 12594.21425282,
    "availableBalance": 8200.0,
    "marginUsed": 4394.21425282,

    "targets": {
      "minWalletPct": 10,
      "stretchWalletPct": [20, 30]
    },

    "limits": {
      "acceptableDrawdownPct": 30,
      "riskPerTradePct": 1,
      "maxActualLeverageNewSetups": 3
    }
  },

  "position": {
    "symbol": "ZECUSDT",
    "side": "SHORT",
    "qty": 100,
    "entryPrice": 389.7168944297,
    "markPrice": 423.29,
    "notional": 42329.0,

    "marginType": "CROSS",
    "leverageSetting": 20,
    "actualLeverage": 3.360987763926758,
    "liquidationPrice": 508.97885879,

    "unrealizedPnl": -3357.310558,
    "openedAt": "2025-12-11T12:52:41.623Z"
  },

  "orders": {
    "open": [
      {
        "type": "TAKE_PROFIT_MARKET",
        "reduceOnly": true,
        "stopPrice": 332.54,
        "status": "NEW"
      }
    ]
  },

  "market": {
    "symbol": "ZECUSDT",
    "session": {
      "localTz": "Asia/Jakarta",
      "isWeekend": true
    }
  },

  "candles": {
    "m15": [
      { "t": "2025-12-14T21:30:00+08:00", "o": 431.2, "h": 433.4, "l": 422.3, "c": 423.2, "v": 79000 },
      { "t": "2025-12-14T21:45:00+08:00", "o": 423.2, "h": 425.1, "l": 419.1, "c": 421.8, "v": 102000 }
      /* ... 48 more ... */
    ],
    "h1": [
      { "t": "2025-12-14T20:00:00+08:00", "o": 441.1, "h": 443.5, "l": 431.6, "c": 434.6, "v": 200174 }
      /* ... 39 more ... */
    ],
    "h4": [
      { "t": "2025-12-14T16:00:00+08:00", "o": 458.0, "h": 476.4, "l": 419.1, "c": 442.0, "v": 8732400 }
      /* ... 24 more ... */
    ],
    "d1": [
      { "t": "2025-12-14T00:00:00+08:00", "o": 472.0, "h": 480.0, "l": 419.0, "c": 442.0, "v": 53000000 }
      /* ... 14 more ... */
    ]
  },

  "computed": {
    "equityTargets": {
      "min10pct": { "profitRequired": 1259.421425282, "requiredPrice": 377.12268017688 },
      "stretch": [
        { "pct": 20, "profitRequired": 2518.842850564, "requiredPrice": 364.52846592406 },
        { "pct": 30, "profitRequired": 3778.264275846, "requiredPrice": 351.93425167124 }
      ]
    },

    "derivedLevelsHint": {
      "note": "Optional. If you already compute levels, pass them here to reduce advisor variance.",
      "support": [422.3, 410.0, 390.0],
      "resistance": [433.4, 447.3, 450.0]
    }
  },

  "question": {
    "type": "trade_management",
    "profitDefinition": "wallet_equity_pct",
    "targetPct": 5,
    "request": "Assess whether the position is structurally valid. Provide management steps toward 10% wallet target, with stretch 20–30%."
  }
}
```

### 1.4 Required advisor output contract (strict)
```json
{
  "positionStatus": "VALID | INVALIDATED",
  "tradeQuality": {
    "grade": "A | B | DEGRADED",
    "thesis": "INTACT | WEAKENING | INVALIDATED"
  },
  "structure": {
    "higherTFBias": { "d1": "bearish|neutral|bullish", "h4": "bearish|neutral|bullish" },
    "lowerTFState": { "h1": "trend|range|transition", "m15": "trend|range|transition" }
  },
  "levels": {
    "invalidation": [
      { "tf": "h1", "rule": "close_above", "price": 450 },
      { "tf": "h4", "rule": "close_above", "price": 455 }
    ],
    "continuation": [
      { "tf": "m15", "rule": "break_below", "price": 422.3 }
    ]
  },
  "equityPlan": {
    "min10pct": { "requiredPrice": 377.12, "stillReachable": true },
    "stretch": [
      { "pct": 20, "requiredPrice": 364.53, "stillReachable": true },
      { "pct": 30, "requiredPrice": 351.93, "stillReachable": true }
    ]
  },
  "scenarios": [
    { "name": "continuation", "prob": 0.65, "path": "423→410→390", "notes": "..." },
    { "name": "reversal", "prob": 0.35, "path": "423→445→450", "notes": "..." }
  ],
  "actions": {
    "recommended": "HOLD | PARTIAL_DERISK | FULL_EXIT | HEDGE_TACTICAL",
    "orders": [
      { "type": "reduce_only_limit", "price": 410, "qty": 15 },
      { "type": "reduce_only_limit", "price": 390, "qty": 20 }
    ],
    "why": "One calm, structure-based paragraph."
  },
  "confidence": {
    "score": 0.0,
    "drivers": ["..."],
    "whatWouldChangeMind": ["..."]
  },
  "verdict": "One sentence, calm, objective."
}
```

---

## 2) Confidence scoring (anti-panic, “is this trade working?”)

Goal: a single score 0–100 that measures whether the trade is behaving like a valid, high-expectancy setup, without overreacting to short-term noise.

### 2.1 Score breakdown (recommended)
Compute 5 subscores (0–20 each), then sum to 0–100.

1) Structure alignment (0–20)
- 20: d1/h4 agree with your position direction
- 10: mixed, transition
- 0: higher TF contradicts position

2) Price action health (0–20)
Evaluate last ~10 candles on h1 and m15:
- impulsive moves in your favor = +
- corrective against you = neutral
- impulsive against you = -

3) Level interaction (0–20)
- price rejecting your resistance (for shorts) or holding your support (for longs) = +
- acceptance through invalidation zone = -

4) Equity potential (0–20)
Given wallet targets:
- if min 10% price target is still realistic before invalidation = +
- if not reachable without exceeding invalidation = -

5) Risk buffer (0–20)
Use liquidation distance and wallet drawdown constraints:
- adequate buffer + no forced actions likely = +
- thin buffer / close to liquidation / margin used too high = -

### 2.2 Mapping to actions (policy)
- 80–100: A-quality, let it work
- 60–79: Valid but noisy
- 40–59: Transition, edge unclear
- 20–39: Degraded
- 0–19: Invalidated

### 2.3 Key anti-panic rule
The advisor must not downgrade confidence based solely on floating PnL.
It may only downgrade when structure/levels degrade or risk buffer collapses.

---

## 3) Winner management to target 10% wallet equity (and capture 20–30%)

This is a state machine. It prevents:
- taking profit too early (never reaches 10%)
- giving back a winner (never locks gains)

### 3.1 Definitions
- Wallet equity = cash in wallet (not floating PnL).
- Min target = +10% wallet equity.
- Stretch targets = +20% and +30% wallet equity.
- Convert wallet targets to required price levels (you already do this in computed.equityTargets).

### 3.2 Management phases

Phase A: Development (before min target reached)
Objective: do not kill the trade unless invalidated.
Rules:
- No tightening stops based on profit.
- Reduce only at structural levels.
- Treat bounces as normal unless invalidation triggers.

Phase B: Payout (min target touched or very close)
Objective: bank the business outcome (10% wallet) without capping upside.
Pattern:
- Realize enough profit to lock ~10% wallet outcome.
- Keep a meaningful runner to attempt 20–30%.
Example:
- TP1 at min target price: close 25–40%
- Move invalidation rule to tighter but structure-based level (not 1m noise)

Phase C: Extension (running for 20–30%)
Objective: stay in while trend persists, exit only on structural flip.
Rules:
- Trail using higher TF invalidation (h1/h4 close-based).
- Use partial scale-outs at stretch targets.
- Never fully exit unless invalidated or final stretch achieved.

### 3.3 Concrete policy rules (good defaults)
- Invalidation must be close-based, not wick-based.
- Scaling: TP1 secure min target; TP2 at 20%; TP3 at 30%; optional runner.
- Do not hedge winners unless confidence < 40 AND hedge has a defined exit rule.

### 3.4 Advisor instructions (drop-in system text)
- When in profit, do not recommend full exit solely due to profit.
- Optimize for reaching +10% wallet equity outcomes.
- If +10% is secured, shift to extension mode and manage for +20–30% using structural invalidation.

---

## Appendix: Minimal candle set vs ideal
- Minimum that works: 10 candles per TF
- Ideal for reliable structure: 30–50 per TF (recommended above)
- Diminishing returns beyond: 100+ per TF

---

## Next implementation step (suggested)
1) Add the candles block (m15/h1/h4/d1) at recommended depths.
2) Enforce the output contract (reject responses that do not comply).
3) Have the UI render: confidence score, invalidation levels, equity target reachability, recommended action + reduce-only orders.
