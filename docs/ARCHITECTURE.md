# Architecture

## System overview

This project is a web-based trading assistant:

- `apps/api`: Backend service that talks to Binance + OpenAI, runs scans, computes risk metrics, and serves a JSON API for the UI.
- `apps/web`: Web UI to show system status, positions, setups, and request analyses.
- `packages/shared`: Shared TypeScript types and schemas used by both API and web.

High-level flow:

1. Browser loads `apps/web`.
2. `apps/web` calls `apps/api` for health, positions, setups, and analysis requests.
3. `apps/api` fetches account + market data from Binance, computes indicators/risk, and optionally calls OpenAI for narrative + decision support.

## Security boundary

- Binance credentials and OpenAI API key live only on the server (`apps/api`).
- The browser never sees exchange secrets.
- The API should default to read-only exchange permissions (MVP).

## Runtime components (phased)

MVP runtime:
- API server
- Web UI
- In-memory state (no DB required for first pass)

Later phases add:
- Persistent storage (encrypted secrets + activity log)
- Scheduler/queue for hourly scans
- Notification integrations (Telegram/Discord/email)

## Folder structure

Planned monorepo layout:

```
binance-advisor/
  apps/
    api/              # Fastify API + services (Binance/OpenAI)
    web/              # React UI (Vite)
  packages/
    shared/           # Shared TS types/schemas
  docs/               # PRD, phases, implementation plan
```

