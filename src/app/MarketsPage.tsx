import { api } from '../api'
import { Badge, Card, ErrorBox, PageTitle, Sparkline, fmtPrice, useFetch } from './ui'

export default function MarketsPage({
  tick,
  prices,
  search,
}: {
  tick: number
  prices: Record<string, number>
  search: string
}) {
  const { data, error } = useFetch<{
    markets: { symbol: string; price: number | null; simulated: boolean; history: number[] }[]
  }>(() => api.markets(), [tick])

  const markets = (data?.markets ?? []).filter((m) =>
    m.symbol.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div>
      <PageTitle
        title={
          <>
            Market <span className="gradient-text">Overview</span>
          </>
        }
        sub="Live prices from the trading engine, updated in real time."
      />
      {error && <ErrorBox message={error} />}
      <Card style={{ padding: 8 }}>
        {markets.map((m) => {
          const live = prices[m.symbol] ?? m.price ?? 0
          const hist = m.history
          const up = hist.length >= 2 && hist[hist.length - 1] >= hist[0]
          const pct = hist.length >= 2 ? ((hist[hist.length - 1] - hist[0]) / hist[0]) * 100 : 0
          return (
            <div
              key={m.symbol}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '12px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ width: 120 }}>
                <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 700, fontFamily: 'Outfit' }}>
                  {m.symbol.replace('USDT', '')}
                </p>
                <p style={{ color: '#475569', fontSize: 11 }}>{m.symbol.replace('USDT', '/USDT')}</p>
              </div>
              <span style={{ color: '#F0F4FF', fontSize: 14, fontFamily: 'JetBrains Mono', flex: 1 }}>
                {fmtPrice(live)}
              </span>
              <span style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono', color: pct >= 0 ? '#10B981' : '#EF4444' }}>
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%
              </span>
              <Sparkline data={hist} color={up ? '#10B981' : '#EF4444'} width={110} height={30} />
              {m.simulated ? <Badge color="#F59E0B">SIMULATED</Badge> : <Badge color="#10B981">LIVE</Badge>}
            </div>
          )
        })}
        {markets.length === 0 && <p style={{ color: '#64748B', fontSize: 13, padding: 16 }}>No markets match your search.</p>}
      </Card>
    </div>
  )
}
