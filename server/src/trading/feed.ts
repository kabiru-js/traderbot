import { BinanceFeed } from './binance'
import { RestPriceSource } from './restFeed'

type Source = 'ws' | 'rest' | 'simulated'

const WS_STALE_MS = 15_000

/**
 * Orchestrates market data sources per symbol, preferring real data:
 *
 *   1. Binance WebSocket (live trades)
 *   2. REST polling (Binance → CoinGecko → Coinbase) when the WS is dead
 *   3. Simulated random walk — only when every real source fails
 *
 * `isSimulated()` is true only in case 3, so the UI badge is honest.
 */
export class MarketFeed {
  private ws = new BinanceFeed()
  private rest: RestPriceSource
  private restStarted = false

  private listeners = new Map<string, Set<(price: number) => void>>()
  private wsListeners = new Map<string, (price: number) => void>()
  private prices = new Map<string, number>()
  private history = new Map<string, number[]>()
  private lastWs = new Map<string, number>()
  private mode = new Map<string, Source>()

  constructor() {
    this.rest = new RestPriceSource((symbol, price) => this.onRestPrice(symbol, price))
  }

  private ensureRest(): void {
    if (this.restStarted) return
    this.restStarted = true
    void this.rest.start()
  }

  subscribe(symbol: string, listener: (price: number) => void): void {
    if (!this.listeners.has(symbol)) this.listeners.set(symbol, new Set())
    this.listeners.get(symbol)!.add(listener)

    if (!this.mode.has(symbol)) {
      this.mode.set(symbol, 'ws')
      const wsListener = (price: number) => this.onWsPrice(symbol, price)
      this.wsListeners.set(symbol, wsListener)
      this.ws.subscribe(symbol, wsListener)
    }
    this.ensureRest()
  }

  unsubscribe(symbol: string, listener: (price: number) => void): void {
    const set = this.listeners.get(symbol)
    if (!set) return
    set.delete(listener)
    if (set.size > 0) return

    this.listeners.delete(symbol)
    const wsListener = this.wsListeners.get(symbol)
    this.wsListeners.delete(symbol)
    if (wsListener) this.ws.unsubscribe(symbol, wsListener)
    this.mode.delete(symbol)
    this.prices.delete(symbol)
    this.history.delete(symbol)
    this.lastWs.delete(symbol)
  }

  getPrice(symbol: string): number | null {
    return this.prices.get(symbol) ?? null
  }

  getHistory(symbol: string): number[] {
    return this.history.get(symbol) ?? []
  }

  isSimulated(symbol: string): boolean {
    return this.mode.get(symbol) === 'simulated'
  }

  private record(symbol: string, price: number): void {
    const h = this.history.get(symbol) ?? []
    h.push(price)
    if (h.length > 120) h.shift()
    this.history.set(symbol, h)
    this.prices.set(symbol, price)
    this.listeners.get(symbol)?.forEach((l) => l(price))
  }

  private onWsPrice(symbol: string, price: number): void {
    if (this.ws.isSimulated(symbol)) {
      // WS degraded to random-walk: prefer REST if it has real data.
      const restPrice = this.rest.getPrice(symbol)
      if (restPrice != null) {
        this.mode.set(symbol, 'rest')
        this.record(symbol, restPrice)
      } else {
        this.mode.set(symbol, 'simulated')
        this.record(symbol, price)
      }
      return
    }
    this.mode.set(symbol, 'ws')
    this.lastWs.set(symbol, Date.now())
    this.record(symbol, price)
  }

  private onRestPrice(symbol: string, price: number): void {
    const wsStale = Date.now() - (this.lastWs.get(symbol) ?? 0) > WS_STALE_MS
    if (this.mode.get(symbol) !== 'ws' || wsStale) {
      this.mode.set(symbol, 'rest')
      this.record(symbol, price)
    }
  }
}
