import type { Request, Response } from 'express'
import { config } from './config'
import { creditDeposit } from './walletService'

/** Creates a Stripe Checkout session for a wallet deposit. */
export async function createCheckoutSession(
  userId: string,
  amountUsd: number,
  origin: string,
): Promise<string> {
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(config.stripeSecretKey)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'NeuralVault wallet deposit' },
          unit_amount: Math.round(amountUsd * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { userId },
    success_url: `${origin}/?deposit=success`,
    cancel_url: `${origin}/?deposit=cancelled`,
  })
  return session.url ?? ''
}

/** Stripe webhook handler — must be mounted with a raw body parser. */
export async function handleStripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
    res.status(501).json({ error: 'Stripe not configured' })
    return
  }
  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(config.stripeSecretKey)
  const sig = req.headers['stripe-signature']
  if (!sig) {
    res.status(400).json({ error: 'Missing signature' })
    return
  }
  let event: { type: string; data: { object: unknown } }
  try {
    event = stripe.webhooks.constructEvent(
      (req as unknown as { rawBody: Buffer }).rawBody,
      sig,
      config.stripeWebhookSecret,
    ) as { type: string; data: { object: unknown } }
  } catch {
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      amount_total?: number
      metadata?: { userId?: string }
    }
    const userId = session.metadata?.userId
    const amount = Number(session.amount_total ?? 0) / 100
    if (userId && amount > 0) {
      await creditDeposit(userId, amount, `stripe:${session.id}`)
    }
  }
  res.json({ received: true })
}
