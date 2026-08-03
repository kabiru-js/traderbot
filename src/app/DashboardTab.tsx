import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, type Portfolio } from '../api'
import { Badge, Card, ErrorBox, PageTitle, fmtMoney, fmtPrice, fmtTime, useFetch } from './ui'

export default function DashboardTab({
  tick,
  prices,
}: {
  tick: number
  prices: Record<string, number>
}) {
  const { data, error, loading } = useFetch<Portfolio>(() => api.portfolio(), [tick])

  const equity = (data?.equity ?? []).map((e) => ({
    t: new Date(e.t).toLocaleTimeString(),
    balance: e.balance,
  }))

  const openPositions = (data?.openPositions ?? []).map((p) => {
    const livePrice = prices[p.symbol] ?? p.price
    const liveUnrealized =
      p.position_side && p.position_size && livePrice
        ? p.position_side === 'LONG'
          ? (livePrice - (p.entry_price ?? 0)) * p.position_size
          : ((p.entry_price ?? 0) - livePrice) * p.position_size
        : p.unrealized_pnl
    return { ...p, livePrice, liveUnrealized }
  })

  return (
    <div>
      <PageTitle
        title={
          <>
            Live <span className="gradient-text">Dashboard</span>
          </>
        }
        sub="Portfolio values update in real time from the paper-trading engine."
      />
      {error && <ErrorBox message={error} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Card>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            WALLET BALANCE
          </p>
          <p style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 700, color: '#F0F4FF' }}>
            {fmtMoney(data?.balance ?? 0)}
          </p>
        </Card>
        <Card>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            TOTAL PNL
          </p>
          <p
            style={{
              fontFamily: 'Outfit',
              fontSize: 24,
              fontWeight: 700,
              color: (data?.totalPnl ?? 0) >= 0 ? '#10B981' : '#EF4444',
            }}
          >
            {fmtMoney(data?.totalPnl ?? 0)}
          </p>
        </Card>
        <Card>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            OPEN POSITIONS
          </p>
          <p style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 700, color: '#F0F4FF' }}>
            {openPositions.length}
          </p>
        </Card>
        <Card>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            RECENT TRADES
          </p>
          <p style={{ fontFamily: 'Outfit', fontSize: 24, fontWeight: 700, color: '#F0F4FF' }}>
            {data?.trades.length ?? 0}
          </p>
        </Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          Portfolio Equity Curve
        </p>
        {equity.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equity} margin={{ left: 8, right: 8 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tick={{ fill: '#475569', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: '#475569', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#0C1222',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94A3B8' }}
                formatter={(v) => [fmtMoney(Number(v)), 'Balance']}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#0EA5E9"
                strokeWidth={2}
                fill="url(#eqGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: '#64748B', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            {loading
              ? 'Loading…'
              : 'No activity yet — add a deposit and start a bot to see your equity curve.'}
          </p>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Open Positions
          </p>
          {openPositions.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>
              No open positions. Start a bot to begin paper trading.
            </p>
          ) : (
            openPositions.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600 }}>
                    {p.symbol.replace('USDT', '/USDT')}
                  </p>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        p.position_side === 'LONG'
                          ? 'rgba(16,185,129,0.15)'
                          : 'rgba(239,68,68,0.15)',
                      color: p.position_side === 'LONG' ? '#10B981' : '#EF4444',
                      fontWeight: 600,
                    }}
                  >
                    {p.position_side}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      color: p.liveUnrealized >= 0 ? '#10B981' : '#EF4444',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {fmtMoney(p.liveUnrealized)}
                  </p>
                  <p style={{ color: '#475569', fontSize: 11 }}>
                    {p.livePrice ? fmtPrice(p.livePrice) : '—'}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Recent Trades
          </p>
          {(data?.trades ?? []).length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>No trades yet.</p>
          ) : (
            (data?.trades ?? [])
              .slice(0, 8)
              .map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: 10 }}>{fmtTime(t.created_at)}</span>
                    <span style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 600 }}>
                      {t.symbol}
                    </span>
                    <Badge color={t.side === 'BUY' ? '#10B981' : '#EF4444'}>{t.side}</Badge>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#94A3B8', fontSize: 11 }}>{fmtPrice(t.price)}</p>
                    {t.pnl_usd != null && (
                      <p
                        style={{
                          color: t.pnl_usd >= 0 ? '#10B981' : '#EF4444',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {fmtMoney(t.pnl_usd)}
                      </p>
                    )}
                  </div>
                </div>
              ))
          )}
        </Card>
      </div>
    </div>
  )
}
