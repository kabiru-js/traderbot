import { Cell, Pie, PieChart } from 'recharts'
import { api, type Portfolio } from '../api'
import { Badge, Card, ErrorBox, PageTitle, fmtMoney, fmtPrice, useFetch } from './ui'

const SYMBOL_COLORS: Record<string, string> = {
  BTC: '#F59E0B',
  ETH: '#8B5CF6',
  SOL: '#10B981',
  BNB: '#FBBF24',
  XRP: '#0EA5E9',
}

export default function PortfolioPage({
  tick,
  prices,
}: {
  tick: number
  prices: Record<string, number>
}) {
  const { data, error } = useFetch<Portfolio>(() => api.portfolio(), [tick])

  const p = data
  const balance = p?.balance ?? 0
  const openPositions = (p?.openPositions ?? []).map((pos) => {
    const livePrice = prices[pos.symbol] ?? pos.price
    const notional = livePrice ? livePrice * (pos.position_size ?? 0) : 0
    const liveUnrealized =
      pos.position_side && pos.position_size && livePrice
        ? pos.position_side === 'LONG'
          ? (livePrice - (pos.entry_price ?? 0)) * pos.position_size
          : ((pos.entry_price ?? 0) - livePrice) * pos.position_size
        : pos.unrealized_pnl
    return { ...pos, livePrice, notional, liveUnrealized }
  })

  const alloc = openPositions
    .filter((x) => x.notional > 0)
    .map((x) => ({
      name: x.symbol.replace('USDT', ''),
      value: x.notional,
      color: SYMBOL_COLORS[x.symbol.replace('USDT', '')] ?? '#0EA5E9',
    }))
  if (balance > 0) alloc.push({ name: 'Cash', value: balance, color: '#475569' })
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0)

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Portfolio</span>
          </>
        }
        sub="Your allocation, positions, and cash."
      />
      {error && <ErrorBox message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }} className="hero-grid">
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Allocation</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <PieChart width={150} height={150}>
              <Pie data={alloc.length ? alloc : [{ name: 'Cash', value: 1, color: '#475569' }]} cx={70} cy={70} innerRadius={44} outerRadius={66} dataKey="value" paddingAngle={2}>
                {alloc.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alloc.map((d) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />
                  <span style={{ color: '#94A3B8' }}>{d.name}</span>
                  <span style={{ color: '#F0F4FF', fontWeight: 700, fontFamily: 'JetBrains Mono', marginLeft: 'auto' }}>
                    {allocTotal ? Math.round((d.value / allocTotal) * 100) : 0}%
                  </span>
                  <span style={{ color: '#475569', fontFamily: 'JetBrains Mono', fontSize: 12 }}>{fmtMoney(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Open Positions</p>
          {openPositions.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>No open positions — start a bot in the Strategy Center.</p>
          ) : (
            openPositions.map((pos) => {
              const entry = pos.entry_price ?? 0
              const pct = entry ? ((pos.livePrice - entry) / entry) * 100 : 0
              const unreal = pos.liveUnrealized
              return (
                <div
                  key={pos.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '11px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ width: 90 }}>
                    <p style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono' }}>
                      {pos.symbol.replace('USDT', '')}
                    </p>
                    <Badge color={pos.position_side === 'LONG' ? '#10B981' : '#EF4444'}>{pos.position_side ?? '—'}</Badge>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#94A3B8', fontSize: 12 }}>
                      {pos.position_size?.toFixed(4)} units @ {fmtPrice(entry)}
                    </p>
                    <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      now {fmtPrice(pos.livePrice ?? 0)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: unreal >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: 13 }}>
                      {fmtMoney(unreal)}
                    </p>
                    <p style={{ color: unreal >= 0 ? '#10B981' : '#EF4444', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                      {pct >= 0 ? '+' : ''}
                      {pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>
    </div>
  )
}
