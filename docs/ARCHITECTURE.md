# Architecture

## System overview

This project is a web-based trading assistant:

- `apps/api`: Backend service that talks to Binance + LLM providers (OpenAI + Claude), runs scans, computes risk metrics, and serves a JSON API for the UI.
- `apps/web`: Web UI to show system status, positions, setups, and request analyses.
- `packages/shared`: Shared TypeScript types and schemas used by both API and web.

High-level flow:

1. Browser loads `apps/web`.
2. `apps/web` calls `apps/api` for health, positions, setups, and analysis requests.
3. `apps/api` fetches account + market data from Binance, computes indicators/risk, and optionally calls multiple LLM providers in parallel for decision support.

## Security boundary

- Binance credentials and LLM API keys (OpenAI + Anthropic) live only on the server (`apps/api`).
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
- Notification integrations (Telegram) + in-app alerts

## LLM provider architecture

We treat LLMs as interchangeable providers behind a small interface:

- `apps/api/src/services/openai/client.ts`: OpenAI implementation (GPT-5 via Responses API)
- `apps/api/src/services/llm/providers/anthropic.ts`: Claude implementation (Anthropic Messages API)
- `apps/api/src/services/llm/aggregate.ts`: runs enabled providers in parallel and returns per-provider results
- `apps/api/src/services/llm/schemas.ts`: shared JSON schemas for structured outputs

Principles:
- Run providers in parallel with timeouts and return partial results if one fails.
- Keep risk math and order constraints deterministic in code.
- Optionally store an audit record of inputs/outputs per provider.

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
