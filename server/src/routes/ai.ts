import { Router } from 'express'
import { pool } from '../db'
import { authMiddleware, requireUser } from '../auth'
import { engine } from '../trading/engine'
import { analyzeMarket, portfolioAnalysis } from '../ai'
import { SYMBOLS } from './bots'

const r = Router()
r.use(authMiddleware)

r.get('/analysis', async (req, res) => {
  const symbol = String(req.query.symbol ?? 'BTCUSDT').toUpperCase()
  const history = engine.getHistory(symbol)
  const analysis = await analyzeMarket(symbol, history)
  res.json({ symbol, analysis })
})

r.get('/portfolio', async (req, res) => {
  const u = requireUser(req)
  const wallet = await pool.query('SELECT balance_usd FROM wallets WHERE user_id = $1', [u.id])
  const bots = await pool.query('SELECT status, pnl_usd FROM bots WHERE user_id = $1', [u.id])
  const realized = bots.rows.reduce((s, b) => s + Number(b.pnl_usd), 0)
  const openPositions = bots.rows.filter((b) => b.status === 'running').length
  const analysis = portfolioAnalysis({
    balance: Number(wallet.rows[0]?.balance_usd ?? 0),
    totalPnl: realized,
    bots: bots.rows,
    openPositions,
  })
  res.json({ analysis })
})

r.get('/recommendations', async (req, res) => {
  const recommendations: { symbol: string; signal: string; score: number; summary: string }[] = []
  for (const symbol of SYMBOLS) {
    const analysis = await analyzeMarket(symbol, engine.getHistory(symbol))
    if (analysis.signal !== 'neutral') {
      recommendations.push({ symbol, signal: analysis.signal, score: analysis.score, summary: analysis.summary })
    }
  }
  res.json({ recommendations: recommendations.slice(0, 5) })
})

export default r
