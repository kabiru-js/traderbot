import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { SYMBOLS } from './bots'

const r = Router()
r.use(authMiddleware)

r.get('/', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    `SELECT id, type, title, body, read, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [u.id],
  )
  const unread = await pool.query(
    'SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read = false',
    [u.id],
  )
  res.json({ notifications: rows, unread: unread.rows[0].n })
})

r.post('/read-all', async (req, res) => {
  const u = requireUser(req)
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [u.id])
  res.json({ ok: true })
})

r.post('/:id/read', async (req, res) => {
  const u = requireUser(req)
  const { rowCount } = await pool.query(
    'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, u.id],
  )
  if (!rowCount) {
    res.status(404).json({ error: 'Notification not found' })
    return
  }
  res.json({ ok: true })
})

// ── Price alerts ──────────────────────────────────────────────────
r.get('/alerts', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    'SELECT id, symbol, target_price, direction, triggered, created_at FROM price_alerts WHERE user_id = $1 ORDER BY created_at DESC',
    [u.id],
  )
  res.json({
    alerts: rows.map((a) => ({
      ...a,
      target_price: Number(a.target_price),
    })),
  })
})

r.post('/alerts', async (req, res) => {
  const u = requireUser(req)
  const symbol = String(req.body?.symbol ?? '').toUpperCase()
  const direction = String(req.body?.direction ?? '')
  const targetPrice = Number(req.body?.targetPrice)
  if (!SYMBOLS.includes(symbol)) {
    res.status(400).json({ error: 'Unsupported symbol' })
    return
  }
  if (direction !== 'above' && direction !== 'below') {
    res.status(400).json({ error: 'Direction must be above or below' })
    return
  }
  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    res.status(400).json({ error: 'Invalid target price' })
    return
  }
  const { rows } = await pool.query(
    `INSERT INTO price_alerts (user_id, symbol, target_price, direction)
     VALUES ($1, $2, $3, $4) RETURNING id, symbol, target_price, direction, triggered, created_at`,
    [u.id, symbol, targetPrice, direction],
  )
  res.status(201).json({
    alert: { ...rows[0], target_price: Number(rows[0].target_price) },
  })
})

r.delete('/alerts/:id', async (req, res) => {
  const u = requireUser(req)
  const { rowCount } = await pool.query(
    'DELETE FROM price_alerts WHERE id = $1 AND user_id = $2',
    [req.params.id, u.id],
  )
  if (!rowCount) {
    res.status(404).json({ error: 'Alert not found' })
    return
  }
  res.json({ ok: true })
})

export default r
