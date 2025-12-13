# Implementation plan

This plan is optimized for an “advisory-first” bot: it recommends actions, but does not place orders until you explicitly opt in to execution with guardrails.

## 0) Decisions to lock in early

1. **Market type**: Spot, USD-M Futures, or both (recommended: start with **USD-M Futures** if positions/leverage/SL management are the core).
2. **Account mode**: read-only (MVP) vs trade-enabled (later).
3. **Strategy time horizon**: what “10% per trade” means (intraday vs swing) and the default timeframe(s) to scan.
4. **Risk constraints**:
   - max leverage (default: `3x`)
   - max risk per trade (e.g. `0.5%`–`2%` of account)
   - max concurrent positions, max correlated exposure
5. **Notification channels**: in-app only first vs Telegram/Discord/email.

## 1) Architecture (what you’re building)

- `apps/api` is the only component that talks to Binance + OpenAI.
- `apps/web` is a status + workflow UI (positions → analyze → review recommendations).
- `packages/shared` holds API contracts (types/schemas).

Key principle: **deterministic math in code; LLM for structured options + explanation**.

## 2) Phase 0 (already scaffolded)

What exists now:
- API health endpoint (`GET /healthz`)
- Web UI polling `/healthz` and showing online/offline

Next small improvements (optional before Phase 1):
- Add `/version` with git SHA/build time (for deployments)
- Add “data freshness” metrics fields to health response

## 3) Phase 1 — Binance read-only integration (positions + orders)

### Backend tasks
1. Add `apps/api/src/services/binance/`:
   - `client.ts`: REST client + request signing
   - `userDataStream.ts`: listenKey lifecycle + account updates
   - `marketData.ts`: websocket kline/ticker snapshots (as needed)
2. Normalize Binance objects into internal domain types:
   - `Position`, `Order`, `Balance`, `MarketPrice`
3. Add API endpoints (read-only):
   - `GET /futures/positions?nonZero=true`
   - `GET /futures/open-orders?symbol=...`
4. Add a minimal “staleness” monitor:
   - track last account update time
   - track last market tick time per subscribed symbol

### Web tasks
1. Positions list + detail view.
2. Show timestamps (“last updated”) and a stale-data warning banner.

### Acceptance criteria
- Positions and open orders match Binance UI.
- UI clearly shows whether data is fresh or stale.

## 4) Phase 2 — On-demand advisor (OpenAI + guardrails)

### Deterministic risk engine (code-first)
Implement in `apps/api/src/domain/risk/`:
- position sizing from account risk %
- stop distance constraints
- leverage cap enforcement (`<=3x` by default)
- liquidation proximity checks (warn + suggested reductions)

### OpenAI integration
Implement in `apps/api/src/services/openai/`:
- `client.ts`: OpenAI client
- `schemas.ts`: strict JSON schema for advisor outputs
- `prompts/`: prompt templates (position management, hedge ideas, scaling plan)

LLM requirements:
- **Pin model version** in config (no “latest” hardcode).
- Use **structured outputs** (JSON) for:
  - proposed actions (move stop, partial close, hedge, scale plan)
  - levels (entry/stop/TP), confidence, assumptions, invalidation triggers

### Advisor endpoint
Add:
- `POST /analysis/position`
  - input: symbol + current position snapshot + user constraints
  - output: structured recommendation options + rationale

### Acceptance criteria
- Output always conforms to schema.
- Output never violates leverage/risk constraints (API rejects/filters if it does).
- Every recommendation includes “why” + “what invalidates this”.

## 5) Phase 3 — Setup scanner (hourly watchlist)

### Scanner engine
Implement in `apps/api/src/domain/scanner/`:
- watchlist config (5–10 markets)
- indicator computation (ATR/volatility, trend filter, S/R proxies, etc.)
- setup templates (breakout, pullback, mean reversion if desired)
- scoring + ranking

### Scheduling
Start simple:
- `node:timers` interval or cron-style scheduler in-process

Later:
- queue + worker separation (Redis/BullMQ) for reliability

### API + UI
- `GET /setups`
- `POST /watchlist`
- UI: watchlist management + setup results feed

### Acceptance criteria
- Scans run on time and results are persisted.
- Each setup provides entry/stop/TP, R:R, and invalidation.

## 6) Phase 4 — Alerts + journaling

Backend:
- event rules (levels hit, risk thresholds, new setup)
- dedupe + rate limiting
- persistence for alerts + analyses

Web:
- notifications panel + activity timeline
- export (CSV/JSON)

## 7) Phase 5 — Optional execution (guardrails + testnet)

Only after Phase 2/3 are stable:
- “proposed orders” preview
- confirm + execute (reduce-only / post-only where appropriate)
- testnet/paper mode
- kill switch + hard safety limits

## 8) Testing strategy

- Unit tests for risk engine (pure functions, deterministic).
- Contract tests for API response shapes.
- Mocked Binance client for integration tests.
- Minimal e2e smoke: UI → health → positions (with mocked API).
