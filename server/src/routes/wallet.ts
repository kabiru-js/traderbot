import { Router } from 'express'
import { pool, withTx } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { config } from '../config'
import { creditDeposit } from '../walletService'
import { notifyUser } from '../notify'
import { emitToUser } from '../realtime'
import {
  createCryptoDeposit,
  listCryptoDeposits,
  simulateCryptoTransfer,
  toPublicDeposit,
} from '../cryptoDeposits'

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

r.post('/withdraw', async (req, res) => {
  const u = requireUser(req)
  const amount = Number(req.body?.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    res.status(400).json({ error: 'Amount must be between $1 and $100,000' })
    return
  }

  const balanceRes = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1',
    [u.id],
  )
  const balance = Number(balanceRes.rows[0]?.balance_usd ?? 0)
  if (amount > balance) {
    res.status(400).json({ error: 'Insufficient balance' })
    return
  }

  // Demo mode processes withdrawals instantly. With real payment rails
  // (Stripe Payouts etc.) this becomes a queued approval flow.
  await withTx(async (c) => {
    await c.query(
      'UPDATE wallets SET balance_usd = balance_usd - $1, updated_at = now() WHERE user_id = $2',
      [amount, u.id],
    )
    await c.query(
      'INSERT INTO transactions (user_id, type, amount, reference) VALUES ($1, $2, $3, $4)',
      [u.id, 'withdraw', -amount, 'demo-withdraw'],
    )
  })
  const updated = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1',
    [u.id],
  )
  const newBalance = Number(updated.rows[0]?.balance_usd ?? 0)
  emitToUser(u.id, 'wallet:update', { balance: newBalance })
  await notifyUser(
    u.id,
    'security',
    'Withdrawal processed',
    `$${amount.toFixed(2)} was withdrawn from your wallet.`,
  )
  res.json({ balance: newBalance, reference: 'demo-withdraw' })
})

// ── Crypto-native deposits (USDC on Ethereum) ────────────────────

r.post('/deposit/crypto', async (req, res) => {
  const u = requireUser(req)
  const amount = Number(req.body?.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    res.status(400).json({ error: 'Amount must be between $1 and $100,000' })
    return
  }
  const open = await pool.query(
    `SELECT count(*)::int AS n FROM crypto_deposits
     WHERE user_id = $1 AND status IN ('pending', 'confirming')`,
    [u.id],
  )
  if (open.rows[0].n >= 5) {
    res.status(400).json({ error: 'Too many pending deposits — confirm or cancel them first' })
    return
  }
  const deposit = await createCryptoDeposit(u.id, Math.round(amount * 100) / 100)
  res.status(201).json({ deposit: toPublicDeposit(deposit) })
})

r.get('/deposits', async (req, res) => {
  const u = requireUser(req)
  const deposits = await listCryptoDeposits(u.id)
  res.json({ deposits: deposits.map(toPublicDeposit) })
})

r.post('/deposits/:id/simulate-transfer', async (req, res) => {
  const u = requireUser(req)
  const ok = await simulateCryptoTransfer(req.params.id, u.id)
  if (!ok) {
    res.status(404).json({ error: 'Deposit not found or already submitted' })
    return
  }
  res.json({ ok: true, status: 'confirming' })
})

export default r
