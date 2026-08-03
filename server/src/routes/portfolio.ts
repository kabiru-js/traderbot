import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { engine } from '../trading/engine'

const r = Router()
r.use(authMiddleware)

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

function asPosition(bot: {
  [key: string]: unknown
  symbol: string
  position_side: string | null
  position_size: string | number | null
  entry_price: string | number | null
  pnl_usd: string | number
}) {
  const price = engine.getPrice(bot.symbol)
  const qty = Number(bot.position_size)
  const entry = Number(bot.entry_price)
  let unrealized = 0
  if (bot.position_side && price) {
    unrealized =
      bot.position_side === 'LONG' ? (price - entry) * qty : (entry - price) * qty
  }
  return {
    id: bot.id as string,
    symbol: bot.symbol,
    strategy: bot.strategy as string,
    position_side: bot.position_side,
    position_size: qty,
    entry_price: entry,
    pnl_usd: Number(bot.pnl_usd),
    price: price ?? null,
    unrealized_pnl: round(unrealized),
  }
}

r.get('/', async (req, res) => {
  const u = requireUser(req)

  const wallet = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1',
    [u.id],
  )
  const bots = await pool.query(
    'SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC',
    [u.id],
  )
  const trades = await pool.query(
    `SELECT t.id, t.side, t.price, t.qty, t.pnl_usd, t.created_at, b.symbol
     FROM trades t JOIN bots b ON b.id = t.bot_id
     WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT 20`,
    [u.id],
  )
  const tx = await pool.query(
    'SELECT type, amount, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at ASC',
    [u.id],
  )

  // Build the equity curve from the transaction ledger.
  let running = 0
  const equity = tx.rows.map((row) => {
    running += Number(row.amount)
    return { t: new Date(row.created_at).toISOString(), balance: round(running) }
  })
  if (equity.length === 0) {
    equity.push({ t: new Date().toISOString(), balance: 0 })
  }

  const openPositions = bots.rows
    .filter((b) => b.position_side)
    .map(asPosition)
  const realized = bots.rows.reduce((sum, b) => sum + Number(b.pnl_usd), 0)
  const unrealized = openPositions.reduce((sum, p) => sum + p.unrealized_pnl, 0)

  res.json({
    balance: Number(wallet.rows[0]?.balance_usd ?? 0),
    totalPnl: round(realized + unrealized),
    equity,
    openPositions,
    trades: trades.rows.map((t) => ({
      ...t,
      price: Number(t.price),
      qty: Number(t.qty),
      pnl_usd: t.pnl_usd != null ? Number(t.pnl_usd) : null,
    })),
  })
})

export default r
