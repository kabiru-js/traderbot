import { Router } from 'express'
import { pool } from '../db'
import {
  authMiddleware,
  hashPassword,
  requireUser,
  signToken,
  verifyPassword,
} from '../auth'
import { config } from '../config'
import { notifyUser } from '../notify'
import { sendEmail } from '../mailer'
import { createAuthToken, hashToken, verifyAuthToken } from './authTokens'

const r = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function buildLink(purpose: 'verify-email' | 'reset-password', token: string): string {
  return `${config.appUrl}/${purpose}?token=${token}`
}

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

  const role =
    config.adminEmail && email.toLowerCase() === config.adminEmail.toLowerCase()
      ? 'admin'
      : 'user'

  const passwordHash = await hashPassword(password)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4) RETURNING id, email, name, role`,
    [email.toLowerCase(), passwordHash, displayName, role],
  )
  await pool.query('INSERT INTO wallets (user_id) VALUES ($1)', [rows[0].id])

  // Email verification flow.
  const token = await createAuthToken(rows[0].id, 'email_verify', 24 * 60)
  const link = buildLink('verify-email', token)
  await sendEmail(
    email,
    'Verify your NeuralVault email',
    `<p>Welcome! Confirm your email to finish signing up:</p><p><a href="${link}">Verify email</a></p>`,
  )

  const user = {
    id: rows[0].id as string,
    email: rows[0].email as string,
    name: rows[0].name as string,
    role: rows[0].role as string,
  }
  res.status(201).json({
    user,
    token: signToken(user),
    emailVerification: {
      pending: true,
      devLink: config.demoMode ? link : undefined,
    },
  })
})

r.post('/verify-email', async (req, res) => {
  const token = String(req.body?.token ?? '')
  const row = await verifyAuthToken('email_verify', token)
  if (!row) {
    res.status(400).json({ error: 'Invalid or expired verification token' })
    return
  }
  await pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [
    row.user_id,
  ])
  await pool.query('DELETE FROM auth_tokens WHERE id = $1', [row.id])
  res.json({ ok: true })
})

r.post('/forgot-password', async (req, res) => {
  const { email } = req.body ?? {}
  const normalized = String(email ?? '').toLowerCase()
  const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [
    normalized,
  ])
  // Always respond the same to avoid leaking which emails exist.
  if (rows.length) {
    const token = await createAuthToken(rows[0].id, 'password_reset', 30)
    const link = buildLink('reset-password', token)
    await sendEmail(
      rows[0].email,
      'Reset your NeuralVault password',
      `<p>Use this link to reset your password (valid 30 minutes):</p><p><a href="${link}">Reset password</a></p>`,
    )
    if (config.demoMode) res.json({ devLink: link })
    else res.json({ ok: true })
  } else {
    res.json({ ok: true })
  }
})

r.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '')
  const password = req.body?.password
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }
  const row = await verifyAuthToken('password_reset', token)
  if (!row) {
    res.status(400).json({ error: 'Invalid or expired reset token' })
    return
  }
  const passwordHash = await hashPassword(password)
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    passwordHash,
    row.user_id,
  ])
  await pool.query('DELETE FROM auth_tokens WHERE id = $1', [row.id])
  await notifyUser(
    row.user_id,
    'security',
    'Password changed',
    'Your password was reset successfully.',
  )
  res.json({ ok: true })
})

r.post('/login', async (req, res) => {
  const { email, password, totpCode } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }
  const { rows } = await pool.query(
    `SELECT id, email, name, role, password_hash, two_factor_enabled, two_factor_secret
     FROM users WHERE email = $1`,
    [email.toLowerCase()],
  )
  const row = rows[0]
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  // Two-factor challenge: password is right, now demand a TOTP code.
  if (row.two_factor_enabled) {
    const { authenticator } = await import('otplib')
    if (
      typeof totpCode !== 'string' ||
      !authenticator.verify({ token: totpCode, secret: row.two_factor_secret })
    ) {
      res.json({ requiresTwoFactor: true })
      return
    }
  }

  const user = {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: (row.role as string) || 'user',
  }
  await notifyUser(
    user.id,
    'security',
    'New sign-in',
    `Signed in at ${new Date().toISOString()}`,
  )
  res.json({ user, token: signToken(user) })
})

r.get('/me', authMiddleware, (req, res) => {
  res.json({ user: requireUser(req) })
})

// ── Two-factor authentication (TOTP) ──────────────────────────────
r.post('/2fa/setup', authMiddleware, async (req, res) => {
  const u = requireUser(req)
  const { authenticator } = await import('otplib')
  const secret = authenticator.generateSecret()
  const otpauthUrl = authenticator.keyuri(u.email, 'NeuralVault', secret)
  await pool.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [
    secret,
    u.id,
  ])
  res.json({ secret, otpauthUrl })
})

r.post('/2fa/enable', authMiddleware, async (req, res) => {
  const u = requireUser(req)
  const code = String(req.body?.code ?? '')
  const { rows } = await pool.query(
    'SELECT two_factor_secret FROM users WHERE id = $1',
    [u.id],
  )
  const secret = rows[0]?.two_factor_secret
  const { authenticator } = await import('otplib')
  if (!secret || !authenticator.verify({ token: code, secret })) {
    res.status(400).json({ error: 'Invalid code' })
    return
  }
  await pool.query('UPDATE users SET two_factor_enabled = true WHERE id = $1', [
    u.id,
  ])
  await notifyUser(
    u.id,
    'security',
    'Two-factor enabled',
    'Two-factor authentication is now active on your account.',
  )
  res.json({ twoFactorEnabled: true })
})

r.post('/2fa/disable', authMiddleware, async (req, res) => {
  const u = requireUser(req)
  const code = String(req.body?.code ?? '')
  const { rows } = await pool.query(
    'SELECT two_factor_secret FROM users WHERE id = $1',
    [u.id],
  )
  const secret = rows[0]?.two_factor_secret
  const { authenticator } = await import('otplib')
  if (!secret || !authenticator.verify({ token: code, secret })) {
    res.status(400).json({ error: 'Invalid code' })
    return
  }
  await pool.query('UPDATE users SET two_factor_enabled = false WHERE id = $1', [
    u.id,
  ])
  await notifyUser(
    u.id,
    'security',
    'Two-factor disabled',
    'Two-factor authentication is now off on your account.',
  )
  res.json({ twoFactorEnabled: false })
})

export default r
