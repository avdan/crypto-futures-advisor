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

## Phase 2 — On-demand position management advisor (OpenAI + Claude + guardrails)

Deliverables:
- Analysis request flow: user selects a position → “Analyze now”
- Deterministic risk engine in code (sizing, stop distance, leverage caps)
- Modular LLM providers:
  - OpenAI (GPT-5)
  - Anthropic Claude
- Run both providers in parallel and show both analyses side-by-side.
- UI lets the user select actionable items from either provider to create an **order plan draft** (no execution in this phase).

Exit criteria:
- Recommendations always respect user constraints (e.g., max 3× leverage)
- Both LLM responses are returned independently (one provider can fail without blocking the other).
- Clear audit log of inputs/outputs per provider and selected actions.

## Phase 3 — Setup scanner (hourly watchlist scans)

Deliverables:
- Watchlist configuration (5–10 markets) + timeframe/strategy presets
- Hourly scanning job (scheduler) producing ranked setup candidates
- UI for setup list + setup details (entry/stop/TP, R:R, rationale)
- Optional LLM summary of the top setups (rule-based results + GPT/Claude summaries)

Exit criteria:
- Scans run on schedule and record results
- Results explain “why this setup” and “what invalidates it”

## Phase 4 — Alerts + Telegram + journaling

Deliverables:
- Alerts for key events (stop proximity, liquidation risk, levels hit, new setups)
- Notification channels:
  - In-app
  - Telegram
- Export endpoints (CSV/JSON) for alerts
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
