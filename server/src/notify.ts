import { pool } from './db'
import { emitToUser } from './realtime'
import { sendEmail } from './mailer'

export type NotificationType = 'security' | 'price_alert' | 'trade' | 'system'

/** Records a notification, pushes it live to the user, emails security events. */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)',
    [userId, type, title, body],
  )
  emitToUser(userId, 'notification', { type, title, body })

  if (type === 'security') {
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [
      userId,
    ])
    if (rows[0]) await sendEmail(rows[0].email, title, `<p>${body}</p>`)
  }
}
