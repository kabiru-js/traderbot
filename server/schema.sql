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

-- ── Auth & profile ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;

-- One-time auth tokens (email verification, password reset)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens (token_hash);

-- Notifications (security, price alerts, trade, system)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- User-defined price alerts
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  target_price NUMERIC(18, 6) NOT NULL,
  direction TEXT NOT NULL,
  triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_open ON price_alerts (triggered);

-- Securely stored exchange API connections (keys encrypted at rest)
CREATE TABLE IF NOT EXISTS exchange_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL,
  label TEXT,
  api_key_enc TEXT NOT NULL,
  api_secret_enc TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Username login (optional, unique; partial index allows multiple NULLs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users (username) WHERE username IS NOT NULL;

-- One-click demo/testnet accounts (mock money, flagged)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Testnet toggle: per-mode wallets, transactions and bots, so mock money
-- never mixes with real funds.
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live';
CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_mode_key ON wallets (user_id, mode);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live';
CREATE INDEX IF NOT EXISTS idx_transactions_user_mode ON transactions (user_id, mode, created_at DESC);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'live';

-- Realistic paper execution: per-fill taker fee (USD)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS fee NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- Crypto-native deposits (USDC on Ethereum)
CREATE TABLE IF NOT EXISTS crypto_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL DEFAULT 'USDC',
  network TEXT NOT NULL DEFAULT 'Ethereum',
  address TEXT NOT NULL,
  amount_usd NUMERIC(18, 2) NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | confirming | confirmed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_crypto_deposits_open ON crypto_deposits (status);
