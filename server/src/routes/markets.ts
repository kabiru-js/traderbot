import { Router } from 'express'
import { engine } from '../trading/engine'
import { SYMBOLS } from './bots'

const r = Router()

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

export default r
