import { config } from './config'

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
const stddev = (arr: number[]) => {
  const m = avg(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

export interface MarketAnalysis {
  signal: 'bullish' | 'bearish' | 'neutral'
  score: number
  volatility: number
  summary: string
}

/** Offline heuristic analysis — momentum vs SMA + volatility. */
export function localAnalysis(symbol: string, prices: number[]): MarketAnalysis {
  if (prices.length < 20) {
    return {
      signal: 'neutral',
      score: 50,
      volatility: 0,
      summary: `${symbol}: not enough data yet (${prices.length}/20 samples).`,
    }
  }
  const recent = prices.slice(-20)
  const last = prices[prices.length - 1]
  const sma = avg(recent)
  const momentum = (last - sma) / sma
  const volatility = stddev(recent) / sma
  const score = Math.round(clamp(50 + momentum * 500, 0, 100))
  const signal = score >= 60 ? 'bullish' : score <= 40 ? 'bearish' : 'neutral'
  return {
    signal,
    score,
    volatility: Math.round(volatility * 10000) / 100,
    summary: `${symbol} at ${last.toFixed(2)}: momentum ${(momentum * 100).toFixed(2)}% vs 20-tick SMA, volatility ${(volatility * 100).toFixed(2)}%. Signal: ${signal} (score ${score}/100).`,
  }
}

/**
 * Market analysis. Uses an OpenAI-compatible provider when configured,
 * otherwise falls back to local heuristics.
 */
export async function analyzeMarket(
  symbol: string,
  prices: number[],
): Promise<MarketAnalysis> {
  if (config.aiApiUrl && config.aiApiKey) {
    try {
      const res = await fetch(config.aiApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content:
                `Analyze ${symbol} using these recent prices: ` +
                `${prices.slice(-30).map((p) => p.toFixed(2)).join(', ')}. ` +
                'Reply with exactly one line: BULLISH|BEARISH|NEUTRAL, score 0-100, one-sentence summary.',
            },
          ],
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[]
        }
        const text = data.choices?.[0]?.message?.content ?? ''
        const signal =
          text.includes('BULLISH') ? 'bullish' : text.includes('BEARISH') ? 'bearish' : 'neutral'
        const scoreMatch = text.match(/(\d{1,3})/)
        const score = scoreMatch ? clamp(Number(scoreMatch[1]), 0, 100) : 50
        return { signal, score, volatility: 0, summary: text }
      }
    } catch (err) {
      console.error('[ai] provider error, falling back to local analysis', err)
    }
  }
  return localAnalysis(symbol, prices)
}

export interface PortfolioAnalysis {
  riskScore: number
  summary: string
  recommendations: string[]
}

export function portfolioAnalysis(input: {
  balance: number
  totalPnl: number
  bots: { status: string; pnl_usd: number }[]
  openPositions: number
}): PortfolioAnalysis {
  const running = input.bots.filter((b) => b.status === 'running').length
  const riskScore = Math.round(clamp(30 + running * 10 + input.openPositions * 5, 0, 100))
  const recommendations: string[] = []
  if (input.balance <= 0) recommendations.push('Deposit funds to keep bots funded.')
  if (running === 0) recommendations.push('No bots running — start at least one strategy.')
  if (input.totalPnl < 0) recommendations.push('Portfolio is down — consider reducing bot capital.')
  if (input.openPositions > 3) recommendations.push('Many open positions — review exposure.')
  if (recommendations.length === 0) {
    recommendations.push('Portfolio is healthy — consider increasing allocation.')
  }
  return {
    riskScore,
    summary: `${running} bot(s) running, ${input.openPositions} open position(s), net PnL ${input.totalPnl.toFixed(2)} USD.`,
    recommendations,
  }
}
