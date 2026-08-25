import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { engine } from '../trading/engine'
import { getActiveMode } from '../mode'

const r = Router()
r.use(authMiddleware)

export const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
export const STRATEGIES = ['momentum', 'mean-reversion']

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/** Bot row → API shape, enriched with the live price and unrealized PnL. */
function enrichBot(bot: {
  [key: string]: unknown
  symbol: string
  position_side: string | null
  position_size: string | number | null
  entry_price: string | number | null
  capital: string | number
  pnl_usd: string | number
}) {
  const price = engine.getPrice(bot.symbol)
  let unrealized = 0
  if (bot.position_side && price) {
    const qty = Number(bot.position_size)
    const entry = Number(bot.entry_price)
    unrealized =
      bot.position_side === 'LONG' ? (price - entry) * qty : (entry - price) * qty
  }
  return {
    ...bot,
    capital: Number(bot.capital),
    pnl_usd: Number(bot.pnl_usd),
    position_size: bot.position_size != null ? Number(bot.position_size) : null,
    entry_price: bot.entry_price != null ? Number(bot.entry_price) : null,
    price: price ?? null,
    unrealized_pnl: round(unrealized),
    simulated: engine.isSimulated(bot.symbol),
  }
}

r.get('/', async (req, res) => {
  const u = requireUser(req)
  const mode = await getActiveMode(u.id)
  const { rows } = await pool.query(
    'SELECT * FROM bots WHERE user_id = $1 AND mode = $2 ORDER BY created_at DESC',
    [u.id, mode],
  )
  res.json({ bots: rows.map(enrichBot), mode })
})

r.post('/', async (req, res) => {
  const u = requireUser(req)
  const symbol = String(req.body?.symbol ?? '').toUpperCase()
  const strategy = String(req.body?.strategy ?? '')
  const capital = Number(req.body?.capital)

  if (!SYMBOLS.includes(symbol)) {
    res.status(400).json({ error: 'Unsupported symbol' })
    return
  }
  if (!STRATEGIES.includes(strategy)) {
    res.status(400).json({ error: 'Unsupported strategy' })
    return
  }
  if (!Number.isFinite(capital) || capital < 100 || capital > 100_000) {
    res.status(400).json({ error: 'Capital must be between $100 and $100,000' })
    return
  }

  const { rows } = await pool.query(
    'INSERT INTO bots (user_id, symbol, strategy, capital, mode) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [u.id, symbol, strategy, capital, await getActiveMode(u.id)],
  )
  res.status(201).json({ bot: enrichBot(rows[0]) })
})

r.post('/:id/start', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
    [req.params.id, u.id],
  )
  if (!rows.length) {
    res.status(404).json({ error: 'Bot not found' })
    return
  }
  const bot = rows[0]

  // Users must fund their wallet before trading.
  const wallet = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1 AND mode = $2',
    [u.id, bot.mode ?? 'live'],
  )
  const balance = Number(wallet.rows[0]?.balance_usd ?? 0)
  if (balance < Number(bot.capital)) {
    res.status(400).json({
      error: `Insufficient balance — add at least $${Number(bot.capital).toFixed(2)} to your wallet first`,
    })
    return
  }

  const updated = await pool.query(
    `UPDATE bots SET status = 'running', started_at = COALESCE(started_at, now())
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, u.id],
  )
  await engine.startBot(updated.rows[0])
  res.json({ bot: enrichBot(updated.rows[0]) })
})

r.post('/:id/stop', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    'SELECT * FROM bots WHERE id = $1 AND user_id = $2',
    [req.params.id, u.id],
  )
  if (!rows.length) {
    res.status(404).json({ error: 'Bot not found' })
    return
  }
  await engine.stopBot(rows[0].id)
  const { rows: updated } = await pool.query('SELECT * FROM bots WHERE id = $1', [
    req.params.id,
  ])
  res.json({ bot: enrichBot(updated[0]) })
})

export default r
