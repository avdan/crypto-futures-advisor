# binance-advisor

Web-based trading assistant for Binance: monitor positions, request real-time analysis, and scan a watchlist for new setups.

## Requirements

- Node.js `>=18.18`

## Monorepo layout

- `apps/api`: backend API (Binance + OpenAI live here)
- `apps/web`: web UI
- `packages/shared`: shared TypeScript types
- `docs`: product and implementation docs

## Local development

1. Install deps:
   - `npm install`
2. Configure env:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
   - Add your Binance Futures read-only key/secret in `apps/api/.env`
3. Run (two terminals):
   - API: `npm -w apps/api run dev`
   - Web: `npm -w apps/web run dev`

## Docs

- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`

## Disclaimer

This is decision-support software. It does not provide financial advice. Trading involves significant risk.
