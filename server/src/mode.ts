import { pool } from './db'

export type AccountMode = 'live' | 'testnet'

/** The user's currently active mode (testnet toggle lives on the user row). */
export async function getActiveMode(userId: string): Promise<AccountMode> {
  const { rows } = await pool.query('SELECT mode FROM users WHERE id = $1', [userId])
  return rows[0]?.mode === 'testnet' ? 'testnet' : 'live'
}
