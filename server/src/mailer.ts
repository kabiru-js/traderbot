import { config } from './config'

/**
 * Sends email via Resend when configured; otherwise logs the message
 * (demo mode). Keeps the rest of the app independent of the provider.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!config.resendApiKey) {
    console.log(`[mailer] (no RESEND_API_KEY) ${subject} -> ${to}`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resendFrom,
        to,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[mailer] send failed', res.status, await res.text())
    }
  } catch (err) {
    console.error('[mailer] send error', err)
  }
}
