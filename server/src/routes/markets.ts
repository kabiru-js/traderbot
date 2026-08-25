import { Router } from 'express'
import { engine } from '../trading/engine'
import { SYMBOLS } from './bots'

const r = Router()

const INTERVALS = ['1m', '5m', '15m', '1h'] as const

/** Live market snapshot for all supported symbols (price + recent history). */
r.get('/', (_req, res) => {
  const markets = SYMBOLS.map((symbol) => ({
    symbol,
    price: engine.getPrice(symbol),
    simulated: engine.isSimulated(symbol),
    history: engine.getHistory(symbol).slice(-30),
  }))
  res.json({ markets })
})

/**
 * OHLC candles for the trading chart. Uses real Binance klines when
 * reachable; otherwise synthesizes candles anchored at the current price.
 */
r.get('/:symbol/candles', async (req, res) => {
  const symbol = String(req.params.symbol ?? '').toUpperCase()
  const interval = String(req.query.interval ?? '1m')
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 10), 300)
  if (!SYMBOLS.includes(symbol)) {
    res.status(400).json({ error: 'Unsupported symbol' })
    return
  }
  if (!(INTERVALS as readonly string[]).includes(interval)) {
    res.status(400).json({ error: 'Interval must be 1m, 5m, 15m or 1h' })
    return
  }

  try {
    const data = (await (
      await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { signal: AbortSignal.timeout(8000) },
      )
    ).json()) as unknown[]
    if (Array.isArray(data) && data.length) {
      const candles = data.map((k) => {
        const arr = k as (string | number)[]
        return {
          time: Math.floor(Number(arr[0]) / 1000),
          open: parseFloat(String(arr[1])),
          high: parseFloat(String(arr[2])),
          low: parseFloat(String(arr[3])),
          close: parseFloat(String(arr[4])),
          volume: parseFloat(String(arr[5])),
        }
      })
      res.json({ candles, simulated: false })
      return
    }
  } catch {
    // fall through to synthesized candles
  }

  // Synthetic fallback — random walk anchored at the current price.
  const price = engine.getPrice(symbol) ?? 100
  const step =
    interval === '1m' ? 60 : interval === '5m' ? 300 : interval === '15m' ? 900 : 3600
  const vol =
    interval === '1m' ? 0.0016 : interval === '5m' ? 0.003 : interval === '15m' ? 0.005 : 0.01
  const now = Math.floor(Date.now() / 1000)
  let p = price * (1 + (Math.random() * 0.02 - 0.01))
  const candles = []
  for (let i = limit - 1; i >= 0; i--) {
    const open = p
    const close = open * (1 + vol * (Math.random() - 0.5) * 2)
    const high = Math.max(open, close) * (1 + vol * Math.random() * 0.5)
    const low = Math.min(open, close) * (1 - vol * Math.random() * 0.5)
    candles.push({ time: now - i * step, open, high, low, close, volume: 0 })
    p = close
  }
  res.json({ candles, simulated: true })
})

export default r
