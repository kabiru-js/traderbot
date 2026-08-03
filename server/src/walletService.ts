import { pool, withTx } from './db'
import { emitToUser } from './realtime'

/** Credits a user's wallet and records a deposit transaction. */
export async function creditDeposit(
  userId: string,
  amountUsd: number,
  reference: string,
): Promise<number> {
  await withTx(async (c) => {
    await c.query(
      'UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = now() WHERE user_id = $2',
      [amountUsd, userId],
    )
    await c.query(
      'INSERT INTO transactions (user_id, type, amount, reference) VALUES ($1, $2, $3, $4)',
      [userId, 'deposit', amountUsd, reference],
    )
  })
  const { rows } = await pool.query(
    'SELECT balance_usd FROM wallets WHERE user_id = $1',
    [userId],
  )
  const balance = Number(rows[0]?.balance_usd ?? 0)
  emitToUser(userId, 'wallet:update', { balance })
  return balance
}
