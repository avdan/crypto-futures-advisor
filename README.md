# binance-advisor

Web-based trading assistant for Binance: monitor positions, request real-time analysis, and scan a watchlist for new setups.

## Requirements

- Node.js `>=18.18`

## Monorepo layout

- `apps/api`: backend API (Binance + OpenAI + Claude live here)
- `apps/web`: web UI
- `packages/shared`: shared TypeScript types
- `docs`: product and implementation docs

## Local development

Important: this is an npm workspaces repo. Run installs from the repo root.

1. Install deps:
   - `npm install`
2. Configure env:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
   - Add your Binance Futures read-only key/secret in `apps/api/.env`
   - Optional: set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in `apps/api/.env` to enable LLM recommendations
3. Run:
   - One command: `npm run dev:all`
   - Or two terminals:
     - API: `npm -w apps/api run dev`
     - Web: `npm -w apps/web run dev`

## Scanner

- Default watchlist + scanner settings live in `apps/api/.env.example`.
- Use the **Setups** tab to edit the watchlist and click “Run scan now”.

## Alerts + Telegram

- In-app alerts are shown in the **Alerts** tab (polls `GET /alerts`).
- Telegram is optional and configured in `apps/api/.env`:
  - `TELEGRAM_ENABLED=true`
  - `TELEGRAM_BOT_TOKEN=...`
  - `TELEGRAM_CHAT_ID=...`
- Send a test message:
  - `curl -sS -X POST http://localhost:3001/notifications/telegram/test -H 'content-type: application/json' -d '{"message":"hello from binance-advisor"}'`

## Exports

- Alerts JSON: `GET /export/alerts.json`
- Alerts CSV: `GET /export/alerts.csv`

## Docs

- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`

## Disclaimer

This is decision-support software. It does not provide financial advice. Trading involves significant risk.
