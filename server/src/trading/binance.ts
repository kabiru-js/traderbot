import WebSocket from 'ws'

const STREAM_URL = 'wss://stream.binance.com:9443/ws'

// Base prices used when the live feed is unreachable.
const SIM_BASE: Record<string, number> = {
  BTCUSDT: 67000,
  ETHUSDT: 3600,
  SOLUSDT: 178,
  BNBUSDT: 590,
  XRPUSDT: 0.63,
}

const MAX_RECONNECTS = 3

/**
 * Client over Binance's public aggTrade stream (one socket per symbol).
 * If the live feed cannot be reached — DNS blocked, unreachable, or too
 * many reconnect failures — it falls back to a simulated random-walk price
 * generator so the platform still works end-to-end. `isSimulated()` lets the
 * UI label the data source honestly.
 */
export class BinanceFeed {
  private clients = new Map<string, WebSocket>()
  private prices = new Map<string, number>()
  private history = new Map<string, number[]>()
  private listeners = new Map<string, Set<(price: number) => void>>()
  private reconnectTimers = new Map<string, NodeJS.Timeout>()
  private reconnectCount = new Map<string, number>()
  private simulated = new Set<string>()
  private simTimers = new Map<string, NodeJS.Timeout>()

  subscribe(symbol: string, listener: (price: number) => void): void {
    if (!this.listeners.has(symbol)) this.listeners.set(symbol, new Set())
    this.listeners.get(symbol)!.add(listener)
    if (!this.clients.has(symbol) && !this.simulated.has(symbol)) {
      this.connect(symbol)
    }
  }

  unsubscribe(symbol: string, listener: (price: number) => void): void {
    const set = this.listeners.get(symbol)
    if (!set) return
    set.delete(listener)
    if (set.size > 0) return
    this.listeners.delete(symbol)
    this.stopSimulation(symbol)
    this.prices.delete(symbol)
    const ws = this.clients.get(symbol)
    this.clients.delete(symbol)
    ws?.close()
  }

  getPrice(symbol: string): number | null {
    return this.prices.get(symbol) ?? null
  }

  /** Rolling price history (capped at 120 samples) for analysis/UI. */
  getHistory(symbol: string): number[] {
    return this.history.get(symbol) ?? []
  }

  private record(symbol: string, price: number): void {
    const h = this.history.get(symbol) ?? []
    h.push(price)
    if (h.length > 120) h.shift()
    this.history.set(symbol, h)
    this.prices.set(symbol, price)
  }

  isSimulated(symbol: string): boolean {
    return this.simulated.has(symbol)
  }

  private connect(symbol: string): void {
    const ws = new WebSocket(`${STREAM_URL}/${symbol.toLowerCase()}@aggTrade`)
    this.clients.set(symbol, ws)
    let gotData = false

    const failTimer = setTimeout(() => {
      // Socket opened but no data within 6s — treat as dead.
      if (!gotData && !this.simulated.has(symbol)) {
        this.startSimulation(symbol)
        ws.close()
      }
    }, 6_000)

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { p?: string }
        const price = parseFloat(msg.p ?? '')
        if (Number.isFinite(price)) {
          gotData = true
          this.reconnectCount.delete(symbol)
          this.record(symbol, price)
          this.listeners.get(symbol)?.forEach((l) => l(price))
        }
      } catch {
        // ignore malformed frames
      }
    })

    ws.on('close', () => {
      clearTimeout(failTimer)
      this.clients.delete(symbol)
      if (!this.simulated.has(symbol) && this.listeners.has(symbol)) {
        this.scheduleReconnect(symbol)
      }
    })

    ws.on('error', (err) => {
      clearTimeout(failTimer)
      const message = err.message ?? ''
      if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
        // Deterministic DNS block — skip retries, go simulated now.
        this.startSimulation(symbol)
        ws.close()
      } else {
        ws.close()
      }
    })
  }

  private scheduleReconnect(symbol: string): void {
    const count = (this.reconnectCount.get(symbol) ?? 0) + 1
    this.reconnectCount.set(symbol, count)
    if (count >= MAX_RECONNECTS) {
      this.reconnectCount.delete(symbol)
      this.startSimulation(symbol)
      return
    }
    const existing = this.reconnectTimers.get(symbol)
    if (existing) clearTimeout(existing)
    this.reconnectTimers.set(
      symbol,
      setTimeout(() => {
        this.reconnectTimers.delete(symbol)
        if (
          this.listeners.has(symbol) &&
          !this.clients.has(symbol) &&
          !this.simulated.has(symbol)
        ) {
          this.connect(symbol)
        }
      }, 2000),
    )
  }

  private startSimulation(symbol: string): void {
    if (this.simulated.has(symbol)) return
    this.simulated.add(symbol)
    console.warn(`[feed] ${symbol}: live feed unavailable — using simulated prices`)

    let price = SIM_BASE[symbol] ?? 100
    this.record(symbol, price)
    this.listeners.get(symbol)?.forEach((l) => l(price))
    this.simTimers.set(
      symbol,
      setInterval(() => {
        price = price * (1 + (Math.random() - 0.5) * 0.0012)
        this.record(symbol, price)
        this.listeners.get(symbol)?.forEach((l) => l(price))
      }, 1000),
    )
  }

  private stopSimulation(symbol: string): void {
    const timer = this.simTimers.get(symbol)
    if (timer) clearInterval(timer)
    this.simTimers.delete(symbol)
    this.simulated.delete(symbol)
  }
}
