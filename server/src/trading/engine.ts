import { pool, withTx } from '../db'
import { emitToUser } from '../realtime'
import { BinanceFeed } from './binance'

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export interface BotRow {
  id: string
  user_id: string
  symbol: string
  strategy: string
  capital: string | number
  status: string
  position_side: string | null
  position_size: string | number | null
  entry_price: string | number | null
  pnl_usd: string | number
}

interface BotState {
  id: string
  userId: string
  symbol: string
  strategy: string
  capital: number
  window: number[]
  lastTradeAt: number
  busy: boolean
  positionSide: string | null
  entryPrice: number | null
  qty: number | null
  pnlUsd: number
  listener: (price: number) => void
}

/**
 * Paper-trading engine. Subscribes to live Binance trades for each running
 * bot's symbol, evaluates the configured strategy, and executes simulated
 * fills at live market prices. Fills persist to Postgres and are pushed to
 * the owning user's socket in real time.
 */
export class TradingEngine {
  private feed = new BinanceFeed()
  private states = new Map<string, BotState>()
  private lastPriceEmit = new Map<string, number>()
  private warmed = new Set<string>()

  // Tunable strategy parameters (paper-trading demo values).
  private readonly WINDOW = 20 // rolling price window for the SMA
  private readonly BAND = 0.0015 // 0.15% threshold vs SMA to trigger entries
  private readonly COOLDOWN_MS = 45_000 // min gap between entries per bot
  private readonly TAKE_PROFIT = 0.01 // 1% target per position
  private readonly STOP_LOSS = 0.015 // 1.5% stop per position

  getPrice(symbol: string): number | null {
    return this.feed.getPrice(symbol)
  }

  getHistory(symbol: string): number[] {
    return this.feed.getHistory(symbol)
  }

  activeCount(): number {
    return this.states.size
  }

  /** Pre-subscribes market data so prices exist for all symbols. */
  async warmup(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      if (this.warmed.has(symbol)) continue
      this.warmed.add(symbol)
      this.feed.subscribe(symbol, () => {})
    }
  }

  isSimulated(symbol: string): boolean {
    return this.feed.isSimulated(symbol)
  }

  anySimulated(): boolean {
    for (const state of this.states.values()) {
      if (this.feed.isSimulated(state.symbol)) return true
    }
    return false
  }

  async startBot(row: BotRow): Promise<void> {
    if (this.states.has(row.id)) return
    const state = this.hydrate(row)
    state.listener = (price) => void this.onTick(state, price)
    this.states.set(row.id, state)
    this.feed.subscribe(row.symbol, state.listener)
    emitToUser(state.userId, 'bot:update', { id: state.id, status: 'running' })
  }

  async stopBot(botId: string): Promise<void> {
    const state = this.states.get(botId)
    this.states.delete(botId)
    if (state) this.feed.unsubscribe(state.symbol, state.listener)

    const { rows } = await pool.query('SELECT * FROM bots WHERE id = $1', [botId])
    const bot = rows[0] as BotRow | undefined
    if (!bot) return

    const price = this.feed.getPrice(bot.symbol)
    const st = state ?? this.hydrate(bot)
    if (bot.position_side && price) {
      await this.closePosition(st, price)
    }
    await pool.query("UPDATE bots SET status='stopped' WHERE id = $1", [botId])
    emitToUser(bot.user_id, 'bot:update', { id: botId, status: 'stopped' })
  }

  /** Resumes any bots that were running before a restart. */
  async resumeRunning(): Promise<void> {
    const { rows } = await pool.query("SELECT * FROM bots WHERE status = 'running'")
    for (const row of rows) await this.startBot(row as BotRow)
  }

  private hydrate(row: BotRow): BotState {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      strategy: row.strategy,
      capital: Number(row.capital),
      window: [],
      lastTradeAt: 0,
      busy: false,
      positionSide: row.position_side,
      entryPrice: row.entry_price != null ? Number(row.entry_price) : null,
      qty: row.position_size != null ? Number(row.position_size) : null,
      pnlUsd: Number(row.pnl_usd ?? 0),
      listener: () => {},
    }
  }

  private onTick(state: BotState, price: number): void {
    state.window.push(price)
    if (state.window.length > this.WINDOW) state.window.shift()

    // Broadcast live prices at most once per second per symbol.
    const now = Date.now()
    const last = this.lastPriceEmit.get(state.symbol) ?? 0
    if (now - last > 1000) {
      this.lastPriceEmit.set(state.symbol, now)
      emitToUser(state.userId, 'price:update', { symbol: state.symbol, price })
    }

    if (state.busy) return
    state.busy = true
    void this.evaluate(state, price)
      .catch((err) => console.error('[engine] tick error', err))
      .finally(() => {
        state.busy = false
      })
  }

  private async evaluate(state: BotState, price: number): Promise<void> {
    if (state.window.length < this.WINDOW) return
    const sma = state.window.reduce((a, b) => a + b, 0) / state.window.length

    if (!state.positionSide) {
      const momentum = state.strategy === 'momentum'
      const longSignal = momentum
        ? price > sma * (1 + this.BAND)
        : price < sma * (1 - this.BAND)
      const shortSignal = momentum
        ? price < sma * (1 - this.BAND)
        : price > sma * (1 + this.BAND)
      const cooled = Date.now() - state.lastTradeAt > this.COOLDOWN_MS
      if (cooled && longSignal) await this.openPosition(state, 'LONG', price)
      else if (cooled && shortSignal) await this.openPosition(state, 'SHORT', price)
      return
    }

    const entry = state.entryPrice!
    const pnlPct =
      state.positionSide === 'LONG' ? (price - entry) / entry : (entry - price) / entry
    if (pnlPct >= this.TAKE_PROFIT || pnlPct <= -this.STOP_LOSS) {
      await this.closePosition(state, price)
    }
  }

  private async openPosition(
    state: BotState,
    side: 'LONG' | 'SHORT',
    price: number,
  ): Promise<void> {
    const qty = round(state.capital / price, 8)
    await withTx(async (c) => {
      await c.query(
        'UPDATE bots SET position_side = $1, position_size = $2, entry_price = $3 WHERE id = $4',
        [side, qty, price, state.id],
      )
      await c.query(
        'INSERT INTO trades (bot_id, user_id, side, price, qty) VALUES ($1, $2, $3, $4, $5)',
        [state.id, state.userId, side === 'LONG' ? 'BUY' : 'SELL', price, qty],
      )
    })
    state.positionSide = side
    state.entryPrice = price
    state.qty = qty
    state.lastTradeAt = Date.now()
    emitToUser(state.userId, 'trade:filled', {
      bot_id: state.id,
      symbol: state.symbol,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      price,
      qty,
      status: 'opened',
    })
    emitToUser(state.userId, 'bot:update', {
      id: state.id,
      position_side: side,
      entry_price: price,
      position_size: qty,
    })
  }

  private async closePosition(state: BotState, price: number): Promise<void> {
    const side = state.positionSide!
    const qty = state.qty!
    const entry = state.entryPrice!
    const pnl = round(
      side === 'LONG' ? (price - entry) * qty : (entry - price) * qty,
    )

    await withTx(async (c) => {
      await c.query(
        `UPDATE bots SET pnl_usd = pnl_usd + $1,
           position_side = NULL, position_size = NULL, entry_price = NULL
         WHERE id = $2`,
        [pnl, state.id],
      )
      await c.query(
        'INSERT INTO trades (bot_id, user_id, side, price, qty, pnl_usd) VALUES ($1, $2, $3, $4, $5, $6)',
        [state.id, state.userId, side === 'LONG' ? 'SELL' : 'BUY', price, qty, pnl],
      )
      await c.query(
        'UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = now() WHERE user_id = $2',
        [pnl, state.userId],
      )
      await c.query(
        'INSERT INTO transactions (user_id, type, amount, reference) VALUES ($1, $2, $3, $4)',
        [state.userId, 'trade', pnl, `bot:${state.id}`],
      )
    })

    state.positionSide = null
    state.entryPrice = null
    state.qty = null
    state.pnlUsd = round(state.pnlUsd + pnl)

    emitToUser(state.userId, 'trade:filled', {
      bot_id: state.id,
      symbol: state.symbol,
      side: side === 'LONG' ? 'SELL' : 'BUY',
      price,
      qty,
      pnl,
      status: 'closed',
    })
    emitToUser(state.userId, 'bot:update', {
      id: state.id,
      pnl_usd: state.pnlUsd,
      position_side: null,
    })

    const { rows } = await pool.query(
      'SELECT balance_usd FROM wallets WHERE user_id = $1',
      [state.userId],
    )
    emitToUser(state.userId, 'wallet:update', {
      balance: Number(rows[0]?.balance_usd ?? 0),
    })
  }
}

export const engine = new TradingEngine()
