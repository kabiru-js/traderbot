import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { config } from './config'
import { ensureSchema, initDb, pool } from './db'
import { handleStripeWebhook } from './stripe'
import { createSocketServer } from './socketServer'
import { engine } from './trading/engine'
import { notifyUser } from './notify'
import { monitorCryptoDeposits } from './cryptoDeposits'
import authRoutes from './routes/auth'
import walletRoutes from './routes/wallet'
import botRoutes from './routes/bots'
import portfolioRoutes from './routes/portfolio'
import profileRoutes from './routes/profile'
import marketsRoutes from './routes/markets'
import notificationRoutes from './routes/notifications'
import aiRoutes from './routes/ai'
import adminRoutes from './routes/admin'
import exchangeRoutes from './routes/exchanges'
import { SYMBOLS } from './routes/bots'

async function main(): Promise<void> {
  console.log('[api] starting…')
  await initDb()
  await ensureSchema()

  const app = express()

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    }),
  )

  // Stripe webhook needs the raw body — must be registered before express.json().
  app.post(
    '/api/stripe-webhook',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook,
  )

  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      demoMode: config.demoMode,
      marketFeed: engine.anySimulated() ? 'simulated' : 'live',
    })
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/wallet', walletRoutes)
  app.use('/api/bots', botRoutes)
  app.use('/api/portfolio', portfolioRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/markets', marketsRoutes)
  app.use('/api/notifications', notificationRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/exchanges', exchangeRoutes)

  // Serve the built frontend (from the Vite build at the repo root) if present.
  const dist =
    config.frontendDist ||
    (fs.existsSync(path.join(__dirname, '..', '..', 'dist'))
      ? path.join(__dirname, '..', '..', 'dist')
      : '')
  if (dist) {
    app.use(express.static(dist))
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  const server = http.createServer(app)
  createSocketServer(server)

  server.listen(config.port, () => {
    console.log(`[api] listening on :${config.port} (demoMode=${config.demoMode})`)
  })

  await engine.resumeRunning()
  await engine.warmup(SYMBOLS)
  console.log('[engine] resumed running bots, markets warm')

  // Price-alert watcher: checks every 5s and fires notifications.
  setInterval(async () => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM price_alerts WHERE triggered = false',
      )
      for (const alert of rows) {
        const price = engine.getPrice(alert.symbol)
        if (price == null) continue
        const target = Number(alert.target_price)
        const hit = alert.direction === 'above' ? price >= target : price <= target
        if (hit) {
          await pool.query('UPDATE price_alerts SET triggered = true WHERE id = $1', [
            alert.id,
          ])
          await notifyUser(
            alert.user_id,
            'price_alert',
            `Price alert: ${alert.symbol}`,  
            `${alert.symbol} is ${alert.direction} ${target} — currently $${price.toFixed(2)}.`,
          )
        }
      }
    } catch (err) {
      console.error('[alerts] check error', err)
    }
  }, 5000)

  // Crypto-deposit watcher: auto-confirms on-chain (or simulated) deposits.
  setInterval(async () => {
    try {
      await monitorCryptoDeposits()
    } catch (err) {
      console.error('[deposits] monitor error', err)
    }
  }, 10_000)

  // Clean shutdown so the embedded database closes its files properly.
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
