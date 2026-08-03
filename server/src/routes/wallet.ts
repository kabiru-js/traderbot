import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { config } from '../config'
import { creditDeposit } from '../walletService'

const r = Router()
r.use(authMiddleware)

r.get('/', async (req, res) => {
  const u = requireUser(req)
  const balance = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1',
    [u.id],
  )
  const tx = await pool.query(
    `SELECT id, type, amount, reference, created_at
     FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [u.id],
  )
  res.json({
    balance: Number(balance.rows[0]?.balance_usd ?? 0),
    transactions: tx.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
  })
})

r.post('/deposit', async (req, res) => {
  const u = requireUser(req)
  const amount = Number(req.body?.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    res.status(400).json({ error: 'Amount must be between $1 and $100,000' })
    return
  }

  if (config.demoMode) {
    const balance = await creditDeposit(u.id, Math.round(amount * 100) / 100, 'demo-deposit')
    res.json({ balance, reference: 'demo-deposit' })
    return
  }

  if (!config.stripeSecretKey) {
    res.status(503).json({ error: 'Deposits unavailable: no payment provider configured' })
    return
  }
  const { createCheckoutSession } = await import('../stripe')
  const checkoutUrl = await createCheckoutSession(
    u.id,
    amount,
    req.headers.origin ?? 'http://localhost:8443',
  )
  res.json({ checkoutUrl })
})

export default r
