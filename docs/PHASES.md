# Phases

## Phase 0 — Foundation (MVP scaffolding)

Deliverables:
- TypeScript monorepo with `apps/api`, `apps/web`, `packages/shared`
- API health endpoint (`/healthz`)
- Web UI showing “online/offline” based on health check
- Local dev instructions + env examples

Exit criteria:
- `apps/api` starts locally and returns a valid health response
- `apps/web` displays online/offline correctly

## Phase 1 — Binance read-only integration (positions + orders)

Deliverables:
- Secure server-side configuration for Binance API key/secret (env-based initially)
- Read-only data ingestion: balances, positions, open orders (Spot/Futures scope selected)
- UI positions page (list + detail) with live refresh
- Activity log of user requests and API calls (in-memory or simple persistence)

Exit criteria:
- Positions shown accurately vs Binance UI
- Data freshness visible (timestamps) and resilient to disconnects

## Phase 2 — On-demand position management advisor (OpenAI + guardrails)

Deliverables:
- Analysis request flow: user selects a position → “Analyze now”
- Deterministic risk engine in code (sizing, stop distance, leverage caps)
- OpenAI integration for:
  - structured recommendation options (JSON)
  - explanation and “what would invalidate this”
- UI that renders recommendations + confidence + assumptions

Exit criteria:
- Recommendations always respect user constraints (e.g., max 3× leverage)
- Clear audit log of inputs/outputs for each analysis

## Phase 3 — Setup scanner (hourly watchlist scans)

Deliverables:
- Watchlist configuration (5–10 markets) + timeframe/strategy presets
- Hourly scanning job (scheduler) producing ranked setup candidates
- UI for setup list + setup details (entry/stop/TP, R:R, rationale)

Exit criteria:
- Scans run on schedule and record results
- Results explain “why this setup” and “what invalidates it”

## Phase 4 — Alerts + notifications + journaling

Deliverables:
- Alerts for key events (stop proximity, liquidation risk, levels hit, new setups)
- Notification channels (in-app + at least one external channel)
- Journaling/export (CSV/JSON)

Exit criteria:
- Alerts are rate-limited and deduplicated
- Users can trace alert → underlying data snapshot

## Phase 5 — Optional execution (with explicit safeguards)

Deliverables:
- “Proposed orders” preview → confirm → execute (reduce-only where applicable)
- Kill switch, max orders/day, max risk constraints
- Testnet/paper trading mode

Exit criteria:
- Execution never violates configured guardrails
- Full audit trail of what was sent to Binance and when

