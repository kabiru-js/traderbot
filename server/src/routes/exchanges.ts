import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { encryptSecret } from '../security'
import { SUPPORTED_EXCHANGES, listAccounts, toPublic, type ExchangeAccountRow } from '../exchanges'

const r = Router()
r.use(authMiddleware)

r.get('/', async (req, res) => {
  const u = requireUser(req)
  res.json({ accounts: await listAccounts(u.id) })
})

r.post('/', async (req, res) => {
  const u = requireUser(req)
  const exchange = String(req.body?.exchange ?? '').toLowerCase()
  const label = typeof req.body?.label === 'string' ? req.body.label.slice(0, 60) : null
  const apiKey = req.body?.apiKey
  const apiSecret = req.body?.apiSecret

  if (!SUPPORTED_EXCHANGES.includes(exchange)) {
    res.status(400).json({ error: 'Unsupported exchange' })
    return
  }
  if (typeof apiKey !== 'string' || !apiKey || typeof apiSecret !== 'string' || !apiSecret) {
    res.status(400).json({ error: 'API key and secret are required' })
    return
  }

  const { rows } = await pool.query<ExchangeAccountRow>(
    `INSERT INTO exchange_accounts (user_id, exchange, label, api_key_enc, api_secret_enc)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [u.id, exchange, label, encryptSecret(apiKey), encryptSecret(apiSecret)],
  )
  res.status(201).json({ account: toPublic(rows[0]) })
})

r.delete('/:id', async (req, res) => {
  const u = requireUser(req)
  const { rowCount } = await pool.query(
    'DELETE FROM exchange_accounts WHERE id = $1 AND user_id = $2',
    [req.params.id, u.id],
  )
  if (!rowCount) {
    res.status(404).json({ error: 'Account not found' })
    return
  }
  res.json({ ok: true })
})

export default r
