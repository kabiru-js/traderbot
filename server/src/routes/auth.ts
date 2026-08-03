import { Router } from 'express'
import { pool } from '../db'
import {
  authMiddleware,
  hashPassword,
  requireUser,
  signToken,
  verifyPassword,
} from '../auth'

const r = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

r.post('/signup', async (req, res) => {
  const { email, password, name } = req.body ?? {}
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'A valid email is required' })
    return
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }
  const displayName =
    typeof name === 'string' && name.trim()
      ? name.trim().slice(0, 60)
      : email.split('@')[0]

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    email.toLowerCase(),
  ])
  if (existing.rowCount) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await hashPassword(password)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3) RETURNING id, email, name`,
    [email.toLowerCase(), passwordHash, displayName],
  )
  await pool.query('INSERT INTO wallets (user_id) VALUES ($1)', [rows[0].id])

  const user = { id: rows[0].id as string, email: rows[0].email as string, name: rows[0].name as string }
  res.status(201).json({ user, token: signToken(user) })
})

r.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }
  const { rows } = await pool.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()],
  )
  const row = rows[0]
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  const user = { id: row.id as string, email: row.email as string, name: row.name as string }
  res.json({ user, token: signToken(user) })
})

r.get('/me', authMiddleware, (req, res) => {
  res.json({ user: requireUser(req) })
})

export default r
