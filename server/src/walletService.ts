import { pool, withTx } from './db'
import { emitToUser } from './realtime'
import type { AccountMode } from './mode'

/** Credits a user's wallet (scoped to a mode) and records a deposit. */
export async function creditDeposit(
  userId: string,
  amountUsd: number,
  reference: string,
  mode: AccountMode = 'live',
): Promise<number> {
  await withTx(async (c) => {
    await c.query(
      'UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = now() WHERE user_id = $2 AND mode = $3',
      [amountUsd, userId, mode],
    )
    await c.query(
      'INSERT INTO transactions (user_id, type, amount, reference, mode) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'deposit', amountUsd, reference, mode],
    )
  })
  const { rows } = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1 AND mode = $2',
    [userId, mode],
  )
  const balance = Number(rows[0]?.balance_usd ?? 0)
  emitToUser(userId, 'wallet:update', { balance })
  return balance
}
