# NeuralVault — AI Crypto Trading Platform

React + Vite frontend (marketing site + authenticated app) with a Node.js/TypeScript
backend: JWT auth, wallet with deposits, paper-trading bots that react to live
market data, and real-time updates over WebSockets.

## Architecture

```
Browser (React)
  ├── REST  /api/auth, /api/wallet, /api/bots, /api/portfolio
  └── WebSocket  /socket.io  (balance, fills, prices stream in real time)
        │
        ▼
Node.js API (server/)
  ├── Express REST API + Socket.IO
  ├── Paper-trading engine — subscribes to Binance market data,
  │   simulates fills at live prices, persists to Postgres
  └── Postgres (embedded PGlite in dev, or Neon/Supabase/Railway)
```

- **Frontend:** `src/` (Vite dev server on :8443, proxies `/api` + `/socket.io` to :8787)
- **Backend:** `server/` (Express + Socket.IO on :8787)

## Quickstart (zero setup)

```bash
pnpm install                 # frontend deps
pnpm --dir server install    # backend deps
pnpm dev:server              # starts API on :8787 (embedded Postgres + Binance feed)
pnpm dev                     # starts the Vite frontend (already running in Figma Make)
```

Open the app → click **Get Started** → create an account → deposit funds → launch a bot.

Notes:

- With no `DATABASE_URL`, the server starts an **embedded Postgres (PGlite)**
  persisted in `server/.pglite` — no Docker/Postgres install needed.
- Market data comes from Binance's public WebSocket. If Binance is unreachable
  from the network (e.g., region-blocked), the feed automatically falls back to
  **simulated prices** — the UI shows a `SIMULATED` badge on bots.
- First startup can take ~30–60s while the embedded database cold-starts.

## Using a real Postgres (Neon / Supabase)

1. Create a free project at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com).
2. Copy the connection string (Neon: `postgresql://user:pass@ep-...neon.tech/neondb?sslmode=require`).
3. Run the API with it:

```bash
DATABASE_URL="postgresql://..." pnpm --dir server dev
```

The schema is applied automatically on boot (`server/schema.sql`, idempotent).

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create account `{email, password, name}` |
| POST | `/api/auth/login` | — | Log in, returns JWT |
| GET | `/api/auth/me` | ✅ | Current user |
| GET | `/api/wallet` | ✅ | Balance + transactions |
| POST | `/api/wallet/deposit` | ✅ | Add funds `{amount}` (instant in demo mode, Stripe Checkout otherwise) |
| GET | `/api/bots` | ✅ | Your bots (with live price + PnL) |
| POST | `/api/bots` | ✅ | Create bot `{symbol, strategy, capital}` |
| POST | `/api/bots/:id/start` | ✅ | Start a bot |
| POST | `/api/bots/:id/stop` | ✅ | Stop a bot (closes position) |
| GET | `/api/portfolio` | ✅ | Balance, equity curve, open positions, trades |
| GET | `/api/health` | — | Health + `marketFeed: live|simulated` |
| POST | `/api/stripe-webhook` | signature | Stripe deposit webhook |

Real-time Socket.IO events: `wallet:update`, `bot:update`, `trade:filled`, `price:update`.

## Deployment

### Render (recommended — one service does everything)

The repo ships a [`render.yaml`](./render.yaml) blueprint:

1. Push this project to a GitHub repo
2. Render dashboard → **New+** → **Blueprint** → pick the repo
3. When prompted, fill the secret env vars:
   - `DATABASE_URL` — your Supabase pooler string, e.g.
     `postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
   - `JWT_SECRET` — any long random string
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — only if taking payments
4. Deploy. The service builds the frontend + API, then serves everything on
   Render's `PORT` with `/api/health` as the health check.

Notes:
- Free Render instances **sleep after ~15 min without traffic**, which pauses
  the trading engine. Bots auto-resume on wake; for always-on trading use a
  paid instance.
- On Render, Binance market data is reachable from their US/EU hosts — bots
  get real live prices (the simulated fallback only kicks in if unreachable).

### Manual single-service deploy (Railway, Render manual, etc.)

1. Build: `pnpm install && pnpm --dir server install && pnpm build && pnpm --dir server build`
2. Start: `pnpm start` (runs `node server/dist/index.js`)
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `DEMO_MODE` (optional), Stripe keys (optional)

Frontend-only hosting (Vercel/Cloudflare/Netlify) also works — deploy `dist/` and
point the API elsewhere, or keep the `/api` + `/socket.io` proxy to a hosted backend.

## Smoke test

```bash
pnpm dev:server        # in one terminal
node scripts/smoke.mjs # in another — full auth/wallet/bot/portfolio flow
```

## Project layout

```
server/            Node.js API
  src/routes/      REST endpoints
  src/trading/     Binance feed + paper-trading engine
  src/db.ts        Postgres pool + embedded PGlite fallback
  schema.sql       Idempotent schema (auto-applied)
src/app/           Authenticated app UI (Dashboard / Bots / Wallet)
src/api.ts         Typed API client
src/store.tsx      Auth context
src/socket.ts      Socket.IO client
scripts/           smoke tests + diagnostics
```
