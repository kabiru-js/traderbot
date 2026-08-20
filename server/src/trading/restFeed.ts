// REST price sources used when the WebSocket feed is unreachable.
// Prices are REAL market data — providers are probed in order and the first
// working one is polled continuously.

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

interface Provider {
  name: string
  fetchPrices: () => Promise<Record<string, number> | null>
}

function providers(): Provider[] {
  const timeout = (ms: number) => AbortSignal.timeout(ms)
  return [
    {
      name: 'binance-rest',
      fetchPrices: async () => {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`,
          { signal: timeout(8000) },
        )
        if (!res.ok) return null
        const data = (await res.json()) as { symbol: string; price: string }[]
        const out: Record<string, number> = {}
        for (const d of data) {
          const v = parseFloat(d.price)
          if (Number.isFinite(v)) out[d.symbol] = v
        }
        return Object.keys(out).length ? out : null
      },
    },
    {
      name: 'coingecko',
      fetchPrices: async () => {
        const ids: Record<string, string> = {
          BTCUSDT: 'bitcoin',
          ETHUSDT: 'ethereum',
          SOLUSDT: 'solana',
          BNBUSDT: 'binancecoin',
          XRPUSDT: 'ripple',
        }
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(ids).join(',')}&vs_currencies=usd`,
          { signal: timeout(8000) },
        )
        if (!res.ok) return null
        const data = (await res.json()) as Record<string, { usd?: number }>
        const out: Record<string, number> = {}
        for (const [sym, id] of Object.entries(ids)) {
          const v = data[id]?.usd
          if (v != null && Number.isFinite(v)) out[sym] = v
        }
        return Object.keys(out).length ? out : null
      },
    },
    {
      name: 'coinbase',
      fetchPrices: async () => {
        const pairs: Record<string, string> = {
          BTCUSDT: 'BTC-USD',
          ETHUSDT: 'ETH-USD',
          SOLUSDT: 'SOL-USD',
          BNBUSDT: 'BNB-USD',
          XRPUSDT: 'XRP-USD',
        }
        const out: Record<string, number> = {}
        for (const [sym, pair] of Object.entries(pairs)) {
          try {
            const res = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`, {
              signal: timeout(5000),
            })
            if (res.ok) {
              const data = (await res.json()) as { data?: { amount?: string } }
              const v = parseFloat(data.data?.amount ?? '')
              if (Number.isFinite(v)) out[sym] = v
            }
          } catch {
            // try next pair
          }
        }
        return Object.keys(out).length ? out : null
      },
    },
  ]
}

/** Polls real market prices from REST APIs; fires per-symbol callbacks. */
export class RestPriceSource {
  provider: string | null = null
  prices = new Map<string, number>()
  private timer: NodeJS.Timeout | null = null
  private pollMs = 4000

  constructor(private onPrice: (symbol: string, price: number) => void) {}

  async start(): Promise<void> {
    await this.poll()
    if (!this.timer) {
      this.timer = setInterval(() => void this.poll(), this.pollMs)
    }
  }

  hasPrice(symbol: string): boolean {
    return this.prices.has(symbol)
  }

  getPrice(symbol: string): number | null {
    return this.prices.get(symbol) ?? null
  }

  private async poll(): Promise<void> {
    for (const p of providers()) {
      try {
        const prices = await p.fetchPrices()
        if (prices && Object.keys(prices).length) {
          this.provider = p.name
          for (const [symbol, price] of Object.entries(prices)) {
            if (Number.isFinite(price)) {
              this.prices.set(symbol, price)
              this.onPrice(symbol, price)
            }
          }
          return
        }
      } catch {
        // try the next provider
      }
    }
  }
}
