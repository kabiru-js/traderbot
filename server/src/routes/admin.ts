import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { engine } from '../trading/engine'

const r = Router()
r.use(authMiddleware)

function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (requireUser(req).role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
r.use(adminOnly)

r.get('/users', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, u.email_verified_at,
            u.two_factor_enabled, w.balance_usd,
            (SELECT count(*)::int FROM bots b WHERE b.user_id = u.id) AS bot_count,
            (SELECT count(*)::int FROM trades t WHERE t.user_id = u.id) AS trade_count
     FROM users u LEFT JOIN wallets w ON w.user_id = u.id
     ORDER BY u.created_at DESC LIMIT 100`,
  )
  res.json({
    users: rows.map((u) => ({
      ...u,
      balance_usd: Number(u.balance_usd ?? 0),
    })),
  })
})

r.get('/stats', async (_req, res) => {
  const [users, activeBots, aum, deposits, withdrawals, trades] = await Promise.all([
    pool.query('SELECT count(*)::int AS n FROM users'),
    pool.query("SELECT count(*)::int AS n FROM bots WHERE status = 'running'"),
    pool.query('SELECT COALESCE(sum(balance_usd), 0)::float AS n FROM wallets'),
    pool.query("SELECT COALESCE(sum(amount), 0)::float AS n FROM transactions WHERE type = 'deposit'"),
    pool.query("SELECT COALESCE(sum(abs(amount)), 0)::float AS n FROM transactions WHERE type = 'withdraw'"),
    pool.query('SELECT count(*)::int AS n FROM trades'),
  ])
  res.json({
    users: users.rows[0].n,
    activeBots: activeBots.rows[0].n,
    totalAumUsd: Number(aum.rows[0].n.toFixed(2)),
    totalDepositsUsd: Number(deposits.rows[0].n.toFixed(2)),
    totalWithdrawalsUsd: Number(withdrawals.rows[0].n.toFixed(2)),
    totalTrades: trades.rows[0].n,
  })
})

r.get('/transactions', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.type, t.amount, t.reference, t.created_at,
            u.email, u.name
     FROM transactions t JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC LIMIT 100`,
  )
  res.json({
    transactions: rows.map((t) => ({ ...t, amount: Number(t.amount) })),
  })
})

r.get('/system', async (_req, res) => {
  let db: string
  try {
    await pool.query('SELECT 1')
    db = 'ok'
  } catch {
    db = 'error'
  }
  res.json({
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    marketFeed: engine.anySimulated() ? 'simulated' : 'live',
    activeBots: engine.activeCount(),
    db,
    time: new Date().toISOString(),
  })
})

export default r
