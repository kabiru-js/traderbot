import { api, type Portfolio } from '../api'
import { Badge, Card, ErrorBox, PageTitle, Sparkline, fmtMoney, fmtPrice, useFetch } from './ui'

const SYMBOL_COLORS: Record<string, string> = {
  BTC: '#F59E0B',
  ETH: '#8B5CF6',
  SOL: '#10B981',
  BNB: '#FBBF24',
  XRP: '#0EA5E9',
}

export default function AssetsPage({
  tick,
  prices,
  search,
}: {
  tick: number
  prices: Record<string, number>
  search: string
}) {
  const markets = useFetch<{ markets: { symbol: string; price: number | null; simulated: boolean; history: number[] }[] }>(
    () => api.markets(),
    [tick],
  )
  const portfolio = useFetch<Portfolio>(() => api.portfolio(), [tick])

  const positions = (portfolio.data?.openPositions ?? []).reduce<Record<string, { qty: number; entry: number; side: string }>>(
    (acc, pos) => {
      acc[pos.symbol] = { qty: pos.position_size ?? 0, entry: pos.entry_price ?? 0, side: pos.position_side ?? '' }
      return acc
    },
    {},
  )

  const rows = (markets.data?.markets ?? [])
    .filter((m) => m.symbol.toLowerCase().includes(search.toLowerCase()))
    .map((m) => {
      const live = prices[m.symbol] ?? m.price ?? 0
      const pos = positions[m.symbol]
      const unreal = pos && live ? (pos.side === 'LONG' ? (live - pos.entry) * pos.qty : (pos.entry - live) * pos.qty) : 0
      return { ...m, live, pos, unreal }
    })

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Assets</span>
          </>
        }
        sub="Track every supported asset and your position in it."
      />
      {markets.error && <ErrorBox message={markets.error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {rows.map((m) => {
          const up = m.history.length >= 2 && m.history[m.history.length - 1] >= m.history[0]
          return (
            <Card key={m.symbol} style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${SYMBOL_COLORS[m.symbol.replace('USDT', '')] ?? '#0EA5E9'}1f`,
                    border: `1px solid ${SYMBOL_COLORS[m.symbol.replace('USDT', '')] ?? '#0EA5E9'}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: SYMBOL_COLORS[m.symbol.replace('USDT', '')] ?? '#0EA5E9',
                  }}
                >
                  {m.symbol.replace('USDT', '').slice(0, 3)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 14, fontFamily: 'Outfit' }}>
                    {m.symbol.replace('USDT', '')}
                  </p>
                  <p style={{ color: '#475569', fontSize: 11 }}>{m.symbol.replace('USDT', '/USDT')}</p>
                </div>
                {m.simulated ? <Badge color="#F59E0B">SIM</Badge> : <Badge color="#10B981">LIVE</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 19, fontWeight: 700, color: '#F0F4FF' }}>
                  {fmtPrice(m.live)}
                </span>
                <span style={{ color: '#475569', fontSize: 12, marginLeft: 'auto' }}>
                  {m.history.length >= 2 ? `${((m.history[m.history.length - 1] - m.history[0]) / m.history[0] * 100).toFixed(2)}%` : '—'}
                </span>
                <Sparkline data={m.history} color={up ? '#10B981' : '#EF4444'} width={70} height={22} />
              </div>
              {m.pos ? (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                  }}
                >
                  <p style={{ color: '#64748B' }}>
                    Position:{' '}
                    <span style={{ color: m.pos.side === 'LONG' ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      {m.pos.side}
                    </span>{' '}
                    · {m.pos.qty.toFixed(4)} units
                  </p>
                  <p style={{ color: m.unreal >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, marginTop: 3 }}>
                    Unrealized: {fmtMoney(m.unreal)}
                  </p>
                </div>
              ) : (
                <p style={{ color: '#334155', fontSize: 12 }}>No position</p>
              )}
            </Card>
          )
        })}
        {rows.length === 0 && (
          <p style={{ color: '#64748B', fontSize: 13 }}>No assets match your search.</p>
        )}
      </div>
    </div>
  )
}
