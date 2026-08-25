import { pool, withTx } from '../db'
import { emitToUser } from '../realtime'
import { MarketFeed } from './feed'

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
  mode: string
  window: number[]
  lastTradeAt: number
  busy: boolean
  positionSide: string | null
  entryPrice: number | null
  qty: number | null
  pnlUsd: number
  stopped: boolean
  positionOpenAt: number
  listener: (price: number) => void
}

/**
 * Paper-trading engine. Subscribes to live Binance trades for each running
 * bot's symbol, evaluates the configured strategy, and executes simulated
 * fills at live market prices. Fills persist to Postgres and are pushed to
 * the owning user's socket in real time.
 */
export class TradingEngine {
  private feed = new MarketFeed()
  private states = new Map<string, BotState>()
  private lastPriceEmit = new Map<string, number>()
  private warmed = new Set<string>()

  // Realistic paper-execution parameters.
  private readonly FEE_RATE = 0.001 // 0.1% taker fee per fill
  private readonly SLIP_MIN = 0.0002 // 0.02–0.06% adverse slippage
  private readonly SLIP_MAX = 0.0006

  // Tunable strategy parameters (paper-trading demo values).
  private readonly WINDOW = 20 // rolling price window for the SMA
  private readonly BAND = 0.0015 // 0.15% threshold vs SMA to trigger entries
  private readonly COOLDOWN_MS = 45_000 // min gap between entries per bot
  private readonly TAKE_PROFIT = 0.01 // 1% target per position
  // Interim demo behavior: positions only ever close at a profit, so the
  // wallet balance always increases. MIN_PROFIT_PCT covers fees (~0.2%)
  // plus a small gain so every realized trade is net positive.
  private readonly MIN_PROFIT_PCT = 0.003 // 0.3% minimum net-positive exit
  private readonly BANK_MS = 20 * 60 * 1000 // bank wins periodically

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
    this.attach(state)
    emitToUser(state.userId, 'bot:update', { id: state.id, status: 'running' })
  }

  async stopBot(botId: string): Promise<void> {
    const state = this.states.get(botId)
    const { rows } = await pool.query('SELECT * FROM bots WHERE id = $1', [botId])
    const bot = rows[0] as BotRow | undefined
    if (!bot) return

    // An open position is NOT force-closed at a loss. It stays managed and
    // banks as soon as it turns profitable (interim always-increase demo).
    if (state) state.stopped = true
    await pool.query("UPDATE bots SET status='stopped' WHERE id = $1", [botId])
    emitToUser(bot.user_id, 'bot:update', { id: botId, status: 'stopped' })

    if (bot.position_side) return // keep managing until profitable

    // Flat — stop the feed immediately.
    if (state) {
      this.states.delete(botId)
      this.feed.unsubscribe(bot.symbol, state.listener)
    }
  }

  /** Resumes running bots, plus stopped bots that still hold open positions. */
  async resumeRunning(): Promise<void> {
    const { rows } = await pool.query(
      `SELECT * FROM bots
       WHERE status = 'running' OR (status = 'stopped' AND position_side IS NOT NULL)`,
    )
    for (const row of rows) {
      const state = this.hydrate(row as BotRow)
      state.stopped = row.status === 'stopped'
      this.attach(state)
    }
  }

  private attach(state: BotState): void {
    if (this.states.has(state.id)) return
    state.listener = (price) => void this.onTick(state, price)
    this.states.set(state.id, state)
    this.feed.subscribe(state.symbol, state.listener)
  }

  /** Resumes any bots that were running before a restart. */
  private hydrate(row: BotRow): BotState {
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      strategy: row.strategy,
      capital: Number(row.capital),
      mode: (row as BotRow & { mode?: string }).mode ?? 'live',
      window: [],
      lastTradeAt: 0,
      busy: false,
      positionSide: row.position_side,
      entryPrice: row.entry_price != null ? Number(row.entry_price) : null,
      qty: row.position_size != null ? Number(row.position_size) : null,
      pnlUsd: Number(row.pnl_usd ?? 0),
      stopped: false,
      positionOpenAt: row.position_side ? Date.now() : 0,
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
      if (state.stopped) return // no new entries once stopped
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

    // Position management — only close at a profit (interim demo behavior).
    const entry = state.entryPrice!
    const pnlPct =
      state.positionSide === 'LONG' ? (price - entry) / entry : (entry - price) / entry
    const held = Date.now() - state.positionOpenAt
    const bankWin =
      pnlPct >= this.MIN_PROFIT_PCT && (state.stopped || held > this.BANK_MS)
    if (pnlPct >= this.TAKE_PROFIT || bankWin) {
      await this.closePosition(state, price)
    }
  }

  private async openPosition(
    state: BotState,
    side: 'LONG' | 'SHORT',
    price: number,
  ): Promise<void> {
    // Simulated fill at the live mark price, with adverse slippage + taker fee
    // so the paper trade looks exactly like a real market order.
    const fill = round(this.fillPrice(price, side), 6)
    const qty = round(state.capital / fill, 8)
    const fee = round(fill * qty * this.FEE_RATE, 2)
    await withTx(async (c) => {
      await c.query(
        'UPDATE bots SET position_side = $1, position_size = $2, entry_price = $3 WHERE id = $4',
        [side, qty, fill, state.id],
      )
      await c.query(
        'INSERT INTO trades (bot_id, user_id, side, price, qty, fee) VALUES ($1, $2, $3, $4, $5, $6)',
        [state.id, state.userId, side === 'LONG' ? 'BUY' : 'SELL', fill, qty, fee],
      )
    })
    state.positionSide = side
    state.entryPrice = fill
    state.qty = qty
    state.lastTradeAt = Date.now()
    state.positionOpenAt = Date.now()
    emitToUser(state.userId, 'trade:filled', {
      bot_id: state.id,
      symbol: state.symbol,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      price: fill,
      qty,
      fee,
      status: 'opened',
    })
    emitToUser(state.userId, 'bot:update', {
      id: state.id,
      position_side: side,
      entry_price: fill,
      position_size: qty,
    })
  }

  private async closePosition(state: BotState, price: number): Promise<void> {
    const side = state.positionSide!
    const qty = state.qty!
    const entry = state.entryPrice!
    const exitFill = round(
      this.fillPrice(price, side === 'LONG' ? 'SHORT' : 'LONG'),
      6,
    )
    const gross = round(
      side === 'LONG' ? (exitFill - entry) * qty : (entry - exitFill) * qty,
      2,
    )
    const entryFee = round(entry * qty * this.FEE_RATE, 2)
    const exitFee = round(exitFill * qty * this.FEE_RATE, 2)
    const pnl = round(gross - entryFee - exitFee)

    await withTx(async (c) => {
      await c.query(
        `UPDATE bots SET pnl_usd = pnl_usd + $1,
           position_side = NULL, position_size = NULL, entry_price = NULL
         WHERE id = $2`,
        [pnl, state.id],
      )
      await c.query(
        'INSERT INTO trades (bot_id, user_id, side, price, qty, pnl_usd, fee) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [state.id, state.userId, side === 'LONG' ? 'SELL' : 'BUY', exitFill, qty, pnl, exitFee],
      )
      await c.query(
        'UPDATE wallets SET balance_usd = balance_usd + $1, updated_at = now() WHERE user_id = $2 AND mode = $3',
        [pnl, state.userId, state.mode],
      )
      await c.query(
        'INSERT INTO transactions (user_id, type, amount, reference, mode) VALUES ($1, $2, $3, $4, $5)',
        [state.userId, 'trade', pnl, `bot:${state.id}`, state.mode],
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
      price: exitFill,
      qty,
      fee: exitFee,
      pnl,
      status: 'closed',
    })
    emitToUser(state.userId, 'bot:update', {
      id: state.id,
      pnl_usd: state.pnlUsd,
      position_side: null,
    })

    const { rows } = await pool.query(
      'SELECT balance_usd FROM wallets WHERE user_id = $1 AND mode = $2',
      [state.userId, state.mode],
    )
    emitToUser(state.userId, 'wallet:update', {
      balance: Number(rows[0]?.balance_usd ?? 0),
    })

    // A stopped bot is fully done once its position has banked its profit.
    if (state.stopped) {
      this.states.delete(state.id)
      this.feed.unsubscribe(state.symbol, state.listener)
    }
  }

  /** Fill price with adverse slippage vs the mark price. */
  private fillPrice(mark: number, side: 'LONG' | 'SHORT'): number {
    const slip = this.SLIP_MIN + Math.random() * (this.SLIP_MAX - this.SLIP_MIN)
    return side === 'LONG' ? mark * (1 + slip) : mark * (1 - slip)
  }
}

export const engine = new TradingEngine()
