import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'

const r = Router()
r.use(authMiddleware)

const USERNAME_RE = /^[a-z0-9_]{3,30}$/

r.get('/', async (req, res) => {
  const u = requireUser(req)
  const { rows } = await pool.query(
    `SELECT id, email, username, name, role, is_demo, email_verified_at, two_factor_enabled, created_at
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
      username: row.username ?? null,
      name: row.name,
      role: row.role,
      demo: !!row.is_demo,
      emailVerified: !!row.email_verified_at,
      twoFactorEnabled: row.two_factor_enabled,
      createdAt: row.created_at,
    },
  })
})

r.patch('/', async (req, res) => {
  const u = requireUser(req)
  const name =
    typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : undefined
  const username =
    typeof req.body?.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : undefined

  if (!name && username === undefined) {
    res.status(400).json({ error: 'Nothing to update' })
    return
  }
  if (username !== undefined && username && !USERNAME_RE.test(username)) {
    res.status(400).json({
      error: 'Username must be 3-30 characters (letters, numbers, underscores)',
    })
    return
  }
  if (username) {
    const taken = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id <> $2',
      [username, u.id],
    )
    if (taken.rowCount) {
      res.status(409).json({ error: 'Username already taken' })
      return
    }
  }

  if (name) {
    await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, u.id])
  }
  if (username !== undefined) {
    await pool.query('UPDATE users SET username = $1 WHERE id = $2', [
      username || null,
      u.id,
    ])
  }

  const { rows } = await pool.query(
    'SELECT id, email, username, name, role FROM users WHERE id = $1',
    [u.id],
  )
  res.json({ profile: rows[0] })
})

export default r
