# PRD — Binance Advisor (Web Bot)

## Summary

A web-based assistant that connects to a user’s Binance account (server-side), displays real-time system/connection status, monitors positions and orders, and provides on-demand and scheduled analysis to help:

1. Manage existing positions (scale in/out, partial close, move stop loss, hedge).
2. Discover new setups from a configurable watchlist (e.g., 5–10 markets scanned hourly).

The user goal is to target ~10% per trade with up to 3× leverage (constraints are configurable and enforced by guardrails).

## Goals

- Show a clear “online/healthy” status with data freshness timestamps.
- Provide explainable, structured recommendations for position management.
- Scan a watchlist on a schedule and surface ranked setup candidates.
- Keep exchange secrets secure (never exposed to browser).

## Non-goals (MVP)

- Fully autonomous trading without confirmation.
- Profit guarantees or guaranteed 10% outcomes.
- Multi-exchange support.

## Target user

Active solo trader using Binance (Spot and/or Futures) who wants help with:
- trade management discipline
- risk controls
- setup discovery without constant chart-watching

## Core workflows

### 1) Health + connectivity
- Web dashboard shows: API up/down, last update timestamps, degraded states (rate-limited, disconnected stream, stale data).

### 2) Positions → “Analyze now”
- User selects a position and requests analysis.
- System returns:
  - current state + risk metrics
  - scenario-based action options (move stop, scale out, hedge)
  - rationale + invalidation triggers

### 3) Watchlist → hourly setup scan
- User configures 5–10 markets.
- Every hour, scanner runs and returns ranked setups with:
  - entry zone, stop, take-profit(s)
  - expected R:R and confidence/quality score
  - why it qualifies + what invalidates it

## Functional requirements

### Binance integration
- Server-side API key storage (MVP: env-based; later: encrypted persistence).
- Read-only endpoints for positions, balances, open orders.
- Market data ingestion (REST snapshots + websockets where needed).
- Rate-limit handling and reconnect logic.

### Advisor engine
- Deterministic risk engine in code:
  - leverage caps (default 3×)
  - risk-per-trade caps
  - stop/TP sanity checks
- OpenAI used for structured options + explanation:
  - model version pinned in config
  - structured JSON output required

### Setup scanner
- Watchlist configuration.
- Strategy templates + scoring.
- Hourly scheduling and result persistence.

### UI
Minimum screens:
- Dashboard (status)
- Positions (list + detail)
- Setups (feed + detail)
- Settings (risk constraints, watchlist, API keys)
- Activity log (analyses, alerts)

## Non-functional requirements

- Low-latency updates (seconds-level for UI refresh).
- Clear degraded mode behavior when Binance is unavailable.
- Strong security: encryption at rest, secrets never logged, TLS in production.
- Observability: health endpoints, metrics, structured logs.

## Disclosures

Decision-support only. Not financial advice. User is responsible for trades and risk.

