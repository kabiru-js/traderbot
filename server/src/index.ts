import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { config } from './config'
import { ensureSchema, initDb } from './db'
import { handleStripeWebhook } from './stripe'
import { createSocketServer } from './socketServer'
import { engine } from './trading/engine'
import authRoutes from './routes/auth'
import walletRoutes from './routes/wallet'
import botRoutes from './routes/bots'
import portfolioRoutes from './routes/portfolio'

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
  console.log('[engine] resumed running bots')

  // Clean shutdown so the embedded database closes its files properly.
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
