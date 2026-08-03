-- NeuralVault schema — idempotent, safe to run on every boot.
-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- deposit | trade
  amount NUMERIC(18, 2) NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user
  ON transactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,          -- e.g. BTCUSDT
  strategy TEXT NOT NULL,        -- momentum | mean-reversion
  capital NUMERIC(18, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',  -- stopped | running
  position_side TEXT,            -- LONG | SHORT | NULL (flat)
  position_size NUMERIC(18, 8),
  entry_price NUMERIC(18, 6),
  pnl_usd NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bots_user ON bots (user_id);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL,            -- BUY | SELL
  price NUMERIC(18, 6) NOT NULL,
  qty NUMERIC(18, 8) NOT NULL,
  pnl_usd NUMERIC(18, 2),        -- set on closing fills
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_id, created_at DESC);
