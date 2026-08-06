import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'

const r = Router()
r.use(authMiddleware)

r.get('/', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    `SELECT id, email, name, role, email_verified_at, two_factor_enabled, created_at
     FROM users WHERE id = $1`,
    [u.id],
  )
  const row = rows[0]
  if (!row) {
    res.status(404).json({ error: 'User not found' })
    return
  }
  res.json({
    profile: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      emailVerified: !!row.email_verified_at,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: row.created_at,
    },
  })
})

r.patch('/', async (req, res) => {
  const u = requireUser(req)
  const name = String(req.body?.name ?? '').trim().slice(0, 60)
  if (!name) {
    res.status(400).json({ error: 'Name is required' })
    return
  }
  await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, u.id])
  const { rows } = await pool.query(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [u.id],
  )
  res.json({ profile: rows[0] })
})

export default r
