# BTC Context Inclusion (Advisor + Scanner)

Use this as the single source of truth for when and how BTC should be included in ALT analysis, and how many candles to supply.

---

## 1) Rule: Include BTC by default for ALT/USDT

For any ALT/USDT perpetual analysis (example: `ZECUSDT`), you MUST include BTC as market regime context, even if the trade is not a BTC pair.

BTC context is used to:
- classify regime: risk_on / risk_off / chop
- estimate wick risk via volatility
- adjust scenario probabilities for the ALT

BTC context must be lightweight and structured. It must not turn into a second full report.

---

## 2) Required BTC outputs (compact “BTC regime block”)

When BTC context is included, output the following fields:

1) `regime`: `risk_on | risk_off | chop`
2) `bias`: `bullish | neutral | bearish`
3) `volatility`: `high | normal | low` (use ATR or candle ranges)
4) `key_levels`: 2 supports + 2 resistances
5) `driver_flag`: `btc_driving | alt_idiosyncratic`
6) `impact_on_alt`: how BTC regime changes probabilities for the ALT (1–3 sentences)

Formatting constraint: BTC block should be max 6 lines if rendered as text.

---

## 3) Candle counts to use (fixed policy)

### 3.1 Advisor (in-position management)
Use these counts by default:

- `BTCUSDT 4H`: **25 candles**
- `BTCUSDT 1D`: **15 candles**

Optional, conditional:

- `BTCUSDT 1W`: **8–12 candles** only if:
  - you are deciding whether to hold for **20–30% wallet equity extension**, OR
  - BTC just made a **major impulsive move**, OR
  - the ALT setup confidence is **borderline (40–60)**

### 3.2 Scanner (setup discovery)
Use smaller counts for speed:

- `BTCUSDT 4H`: **15 candles**
- `BTCUSDT 1D`: **10 candles**

---

## 4) When to include ALTBTC (relative strength filter)

Add `ALTBTC` candles only when at least one is true:
- BTC volatility is **high** on 4H
- the ALT trade is near a decision point (hold vs reduce vs exit vs run)
- you are managing a winner (payout/extension phase)

Candle counts:
- `ALTBTC 4H`: **20 candles**
- `ALTBTC 1D`: **12 candles**

Interpretation rule: ALTBTC informs whether the ALT is strong or weak relative to BTC.
It does not replace ALTUSDT execution levels.

---

## 5) Decision rule: BTC informs probabilities, does not override structure

- BTC regime adjusts scenario probabilities for the ALT.
- BTC must not override the ALT structural read unless `driver_flag = btc_driving`.

Heuristic:
- If `regime=risk_off` or `volatility=high`, increase probability of downside wicks and reduce confidence in clean continuations.
- If `regime=risk_on`, increase probability of ALT continuation only if ALT structure agrees.
- If BTC is flat/chop, treat ALT moves as more likely idiosyncratic.

---

## 6) System prompt snippet (drop-in)

Use this text in your advisor’s system prompt:

> BTC Context Requirement:
> - For any ALT/USDT perpetual analysis, you MUST also analyze BTCUSDT as market regime context.
> - BTC analysis must be lightweight and structured, not a full second report.
> - Use BTC timeframes: 4H and 1D by default (weekly optional per policy).
> - BTC outputs must include: regime, bias, volatility, two supports and two resistances, driver_flag, and impact_on_alt.
> - BTC adjusts probabilities; it does not override ALT structure unless driver_flag=btc_driving.

---

## 7) JSON contract (inputs)

Add this to your request payload:

```json
{
  "context": {
    "btc": {
      "symbol": "BTCUSDT",
      "timeframes": {
        "h4": { "candles": 25 },
        "d1": { "candles": 15 },
        "w1": { "candles": 10, "enabled": false }
      },
      "requiredOutputs": [
        "regime",
        "bias",
        "volatility",
        "key_levels",
        "driver_flag",
        "impact_on_alt"
      ]
    },
    "altbtc": {
      "symbol": "ZECBTC",
      "enabled": false,
      "timeframes": {
        "h4": { "candles": 20 },
        "d1": { "candles": 12 }
      }
    }
  }
}
```

---

## 8) JSON contract (outputs)

Include this BTC block in the advisor response:

```json
{
  "btcContext": {
    "regime": "risk_on | risk_off | chop",
    "bias": "bullish | neutral | bearish",
    "volatility": "high | normal | low",
    "key_levels": {
      "support": [0, 0],
      "resistance": [0, 0]
    },
    "driver_flag": "btc_driving | alt_idiosyncratic",
    "impact_on_alt": "Short explanation of how BTC changes ALT scenario probabilities."
  }
}
```

---

## 9) Practical defaults (copy/paste)

Advisor default:
- BTC 4H: 25 candles
- BTC 1D: 15 candles

Scanner default:
- BTC 4H: 15 candles
- BTC 1D: 10 candles

ALTBTC when enabled:
- 4H: 20 candles
- 1D: 12 candles
