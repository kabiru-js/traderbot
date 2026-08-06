import crypto from 'node:crypto'
import { pool } from '../db'

export const hashToken = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex')

/** Creates a one-time auth token (stores only its SHA-256 hash). */
export async function createAuthToken(
  userId: string,
  purpose: 'email_verify' | 'password_reset',
  ttlMinutes: number,
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex')
  await pool.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, hashToken(raw), ttlMinutes],
  )
  return raw
}

/** Looks up a valid (unexpired) token; returns the row or null. */
export async function verifyAuthToken(
  purpose: 'email_verify' | 'password_reset',
  raw: string,
): Promise<{ id: string; user_id: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, user_id FROM auth_tokens
     WHERE purpose = $1 AND token_hash = $2 AND expires_at > now()`,
    [purpose, hashToken(raw)],
  )
  return rows[0] ?? null
}
