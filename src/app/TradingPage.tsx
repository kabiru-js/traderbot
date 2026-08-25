import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { api, type Bot, type Candle, type Portfolio, type Wallet } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GradientButton,
  GhostButton,
  fmtMoney,
  fmtPrice,
  fmtTime,
  inputStyle,
  useFetch,
} from './ui'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
const TIMEFRAMES = ['1m', '5m', '15m', '1h'] as const

interface ChartCandle {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
}

export default function TradingPage({
  tick,
  prices,
  onAddFunds,
}: {
  tick: number
  prices: Record<string, number>
  onAddFunds: () => void
}) {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('1m')
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartApiRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastCandleRef = useRef<ChartCandle | null>(null)

  const wallet = useFetch<Wallet>(() => api.wallet(), [tick])
  const bots = useFetch<{ bots: Bot[] }>(() => api.bots(), [tick])
  const portfolio = useFetch<Portfolio>(() => api.portfolio(), [tick])
  const candles = useFetch<{ candles: Candle[]; simulated: boolean }>(
    () => api.candles(symbol, timeframe),
    [symbol, timeframe],
  )

  const balance = wallet.data?.balance ?? 0
  const bot = (bots.data?.bots ?? []).find((b) => b.symbol === symbol) ?? null
  const candleClose = candles.data?.candles.slice(-1)[0]?.close
  const livePrice = prices[symbol] ?? candleClose ?? null

  const botTrades = (portfolio.data?.trades ?? []).filter((t) => t.symbol === symbol)
  const unrealized =
    bot?.position_side && bot.position_size && livePrice
      ? bot.position_side === 'LONG'
        ? (livePrice - (bot.entry_price ?? 0)) * bot.position_size
        : ((bot.entry_price ?? 0) - livePrice) * bot.position_size
      : 0
  const equity = balance + unrealized

  // Initialize the chart once.
  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748B',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      borderVisible: false,
    })
    chartApiRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartApiRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Load candles into the chart.
  useEffect(() => {
    const data = candles.data?.candles
    const series = seriesRef.current
    if (!data?.length || !series) return
    const mapped: ChartCandle[] = data.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    lastCandleRef.current = mapped[mapped.length - 1]
    series.setData(mapped)
    chartApiRef.current?.timeScale().fitContent()
  }, [candles.data])

  // Live-tick the last candle.
  useEffect(() => {
    const series = seriesRef.current
    const last = lastCandleRef.current
    if (!series || !last || livePrice == null) return
    const updated: ChartCandle = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    }
    lastCandleRef.current = updated
    series.update(updated)
  }, [livePrice])

  const start = async () => {
    setError(null)
    setBusy(true)
    try {
      let b = bot
      if (!b) {
        b = (await api.createBot({ symbol, strategy: 'momentum', capital: Number(amount) })).bot
      }
      if (b.status !== 'running') await api.startBot(b.id)
      bots.refresh()
      portfolio.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (!bot) return
    setError(null)
    setBusy(true)
    try {
      await api.stopBot(bot.id)
      bots.refresh()
      portfolio.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const needsFunds = balance <= 0

  return (
    <div>
      {/* Symbol + timeframe toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              style={{
                background: symbol === s ? 'rgba(14,165,233,0.12)' : 'transparent',
                border: symbol === s ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                color: symbol === s ? '#0EA5E9' : '#94A3B8',
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                background: timeframe === tf ? 'rgba(14,165,233,0.12)' : 'transparent',
                border: timeframe === tf ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                color: timeframe === tf ? '#0EA5E9' : '#64748B',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }} className="hero-grid">
        {/* Chart */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 16, color: '#F0F4FF' }}>
              {symbol.replace('USDT', '/USDT')}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 15, fontWeight: 700, color: '#F0F4FF' }}>
              {livePrice != null ? fmtPrice(livePrice) : '—'}
            </span>
            {candles.data?.simulated && <Badge color="#F59E0B">SIMULATED FEED</Badge>}
            {bot?.status === 'running' && <Badge color="#10B981">AI TRADING</Badge>}
          </div>
          <div ref={chartRef} style={{ height: 460, width: '100%' }} />
        </Card>

        {/* Trading panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Account */}
          <Card style={{ padding: 16 }}>
            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Account
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748B', fontSize: 12 }}>Balance</span>
              <span style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {fmtMoney(balance)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#64748B', fontSize: 12 }}>Equity</span>
              <span style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {fmtMoney(equity)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B', fontSize: 12 }}>Open P&L</span>
              <span style={{ color: unrealized >= 0 ? '#10B981' : '#EF4444', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                {fmtMoney(unrealized)}
              </span>
            </div>
          </Card>

          {/* Trade panel */}
          <Card style={{ padding: 16 }}>
            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              AI Trading
            </p>
            {needsFunds ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ color: '#F59E0B', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Add funds to start trading
                </p>
                <GradientButton onClick={onAddFunds} style={{ width: '100%' }}>
                  Add money →
                </GradientButton>
              </div>
            ) : (
              <>
                {!bot && (
                  <Field label="Amount (USD)">
                    <input
                      style={inputStyle}
                      type="number"
                      min={100}
                      max={balance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                )}
                {bot?.status === 'running' ? (
                  <>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 9,
                        padding: '10px 12px',
                        marginBottom: 10,
                        fontSize: 12,
                      }}
                    >
                      <p style={{ color: '#64748B', marginBottom: 4 }}>
                        Position:{' '}
                        <span style={{ color: bot.position_side === 'LONG' ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                          {bot.position_side ?? 'FLAT'}
                        </span>
                      </p>
                      {bot.position_side && (
                        <p style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                          {bot.position_size?.toFixed(4)} @ {fmtPrice(bot.entry_price ?? 0)}
                        </p>
                      )}
                    </div>
                    <GhostButton onClick={stop} disabled={busy} style={{ width: '100%', color: '#EF4444', borderColor: 'rgba(239,68,68,0.4)' }}>
                      Stop Trading
                    </GhostButton>
                  </>
                ) : (
                  <GradientButton onClick={start} disabled={busy} style={{ width: '100%' }}>
                    {busy ? 'Starting…' : bot ? 'Resume Trading' : 'Start Trading'}
                  </GradientButton>
                )}
                {bot && bot.status !== 'running' && (
                  <p style={{ color: '#475569', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                    Capital: {fmtMoney(bot.capital)} · Realized P&L:{' '}
                    <span style={{ color: bot.pnl_usd >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      {fmtMoney(bot.pnl_usd)}
                    </span>
                  </p>
                )}
              </>
            )}
          </Card>

          {/* Recent trades — the trade statement */}
          <Card style={{ padding: 16, flex: 1 }}>
            <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Trade Statement
            </p>
            {botTrades.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: 12 }}>No executed trades yet.</p>
            ) : (
              botTrades.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: t.side === 'BUY' ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                      {t.side}
                    </span>
                    <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono' }}>{fmtPrice(t.price)}</span>
                    <span style={{ color: '#475569', fontFamily: 'JetBrains Mono' }}>{t.qty.toFixed(4)}</span>
                    {t.pnl_usd != null ? (
                      <span style={{ color: t.pnl_usd >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                        {fmtMoney(t.pnl_usd)}
                      </span>
                    ) : (
                      <span style={{ color: '#475569', fontFamily: 'JetBrains Mono' }}>{fmtTime(t.created_at)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
