import { useState } from 'react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Sparkles } from 'lucide-react'
import { api, type Portfolio, type Wallet } from '../api'
import {
  Badge,
  Card,
  fmtMoney,
  fmtPrice,
  fmtTime,
  Sparkline,
  useFetch,
} from './ui'

const SYMBOL_COLORS: Record<string, string> = {
  BTC: '#F59E0B',
  ETH: '#8B5CF6',
  SOL: '#10B981',
  BNB: '#FBBF24',
  XRP: '#0EA5E9',
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function OverviewPage({
  tick,
  prices,
  userName,
}: {
  tick: number
  prices: Record<string, number>
  userName: string
}) {
  const portfolio = useFetch<Portfolio>(() => api.portfolio(), [tick])
  const wallet = useFetch<Wallet>(() => api.wallet(), [tick])
  const markets = useFetch<{ markets: { symbol: string; price: number | null; simulated: boolean; history: number[] }[] }>(
    () => api.markets(),
    [tick],
  )
  const ai = useFetch<{ analysis: { riskScore: number; summary: string; recommendations: string[] } }>(
    () => api.aiPortfolio(),
    [tick],
  )
  const [range, setRange] = useState<'1W' | '1M' | '3M' | 'ALL'>('1M')

  const p = portfolio.data
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
  const unrealized = openPositions.reduce((s, x) => s + x.liveUnrealized, 0)
  const totalValue = balance + unrealized

  // Allocation: open positions + cash
  const alloc = openPositions
    .filter((x) => x.notional > 0)
    .map((x) => ({
      name: x.symbol.replace('USDT', ''),
      value: x.notional,
      color: SYMBOL_COLORS[x.symbol.replace('USDT', '')] ?? '#0EA5E9',
    }))
  if (balance > 0) alloc.push({ name: 'Cash', value: balance, color: '#475569' })
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0)

  // Equity series sliced by range
  const equityAll = (p?.equity ?? []).map((e) => ({ t: new Date(e.t).toLocaleTimeString(), balance: e.balance }))
  const slice = range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : equityAll.length
  const equity = equityAll.slice(-slice)
  const first = equity[0]?.balance ?? totalValue
  const todayPct = first ? ((totalValue - first) / first) * 100 : 0

  // Recent activity timeline
  const activity: { id: string; time: string; title: string; sub: string; tone: string }[] = []
  for (const t of wallet.data?.transactions ?? []) {
    activity.push({
      id: `tx-${t.id}`,
      time: t.created_at,
      title: t.type === 'deposit' ? 'Deposit received' : t.type === 'withdraw' ? 'Withdrawal' : 'Strategy P&L',
      sub: t.type === 'deposit' ? `${fmtMoney(t.amount)} added` : t.type === 'withdraw' ? `${fmtMoney(-t.amount)} withdrawn` : `P&L ${fmtMoney(t.amount)}`,
      tone: t.amount >= 0 ? '#10B981' : '#EF4444',
    })
  }
  for (const t of p?.trades ?? []) {
    activity.push({
      id: `tr-${t.id}`,
      time: t.created_at,
      title: `${t.side === 'BUY' ? 'BTC purchase' : 'BTC sale'}`.replace('BTC', t.symbol ?? ''),
      sub: `${t.qty.toFixed(4)} ${t.symbol} · ${fmtPrice(t.price)}${t.pnl_usd != null ? ` · ${fmtMoney(t.pnl_usd)}` : ''}`,
      tone: t.side === 'BUY' ? '#0EA5E9' : '#8B5CF6',
    })
  }
  const notifs = useFetch<{ notifications: { id: string; type: string; title: string; created_at: string }[] }>(
    () => api.notifications(),
    [],
  )
  for (const n of notifs.data?.notifications ?? []) {
    if (n.type !== 'security') continue
    activity.push({
      id: `nt-${n.id}`,
      time: n.created_at,
      title: n.title,
      sub: 'Security event',
      tone: '#EF4444',
    })
  }
  activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const risk = ai.data?.analysis?.riskScore ?? 0
  const riskLevel = risk >= 70 ? 'HIGH' : risk >= 40 ? 'MODERATE' : 'LOW'
  const riskTone = risk >= 70 ? '#EF4444' : risk >= 40 ? '#F59E0B' : '#10B981'

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>
          {greeting()}, {userName || 'there'}
        </h2>
        <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
          Here's what's happening with your portfolio today.
        </p>
      </div>

      {/* Portfolio hero card */}
      <Card
        style={{
          marginBottom: 20,
          padding: 24,
          boxShadow: '0 0 60px rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Total Portfolio Value
          </p>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#10B981', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
            LIVE
          </span>
        </div>
        <p style={{ fontFamily: 'Outfit', fontSize: 'clamp(34px, 4vw, 46px)', fontWeight: 800, color: '#F0F4FF', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {fmtMoney(totalValue)}
        </p>
        <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: todayPct >= 0 ? '#10B981' : '#EF4444' }}>
          {todayPct >= 0 ? '+' : ''}
          {fmtMoney(totalValue - first)} {' '}
          <span style={{ fontFamily: 'JetBrains Mono' }}>{todayPct >= 0 ? '+' : ''}{todayPct.toFixed(2)}%</span>
          <span style={{ color: '#475569', fontWeight: 400 }}> since start</span>
        </p>

        {/* Performance graph */}
        <div style={{ marginTop: 20 }}>
          {equity.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equity} margin={{ left: 4, right: 4 }}>
                <defs>
                  <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={60} />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ background: '#0C1222', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(v) => [fmtMoney(Number(v)), 'Value']}
                />
                <Area type="monotone" dataKey="balance" stroke="#0EA5E9" strokeWidth={2} fill="url(#ovGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: '#64748B', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>
              Add a deposit and start a bot to see your equity curve.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {(['1W', '1M', '3M', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: range === r ? 'rgba(14,165,233,0.12)' : 'transparent',
                border: range === r ? '1px solid rgba(14,165,233,0.25)' : '1px solid transparent',
                color: range === r ? '#0EA5E9' : '#475569',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </Card>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: "Today's P&L", value: `${todayPct >= 0 ? '+' : ''}${fmtMoney(totalValue - first)}`, tone: todayPct >= 0 ? '#10B981' : '#EF4444' },
          { label: 'Total P&L', value: `${(p?.totalPnl ?? 0) >= 0 ? '+' : ''}${fmtMoney(p?.totalPnl ?? 0)}`, tone: (p?.totalPnl ?? 0) >= 0 ? '#10B981' : '#EF4444' },
          { label: 'Risk Score', value: `${risk} / 100`, tone: riskTone, sub: riskLevel },
          { label: 'Available', value: fmtMoney(balance), tone: '#F0F4FF' },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {m.label}
            </p>
            <p style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, color: m.tone, lineHeight: 1 }}>
              {m.value}
            </p>
            {m.sub && <p style={{ color: '#64748B', fontSize: 11, marginTop: 6, fontFamily: 'JetBrains Mono' }}>{m.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        {/* AI intelligence panel */}
        <Card style={{ border: '1px solid rgba(139,92,246,0.18)', position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at top left, rgba(139,92,246,0.08), transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, position: 'relative' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <Sparkles size={14} /> AI Portfolio Intelligence
            </p>
            <span style={{ color: '#475569', fontSize: 11 }}>Updated live</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, position: 'relative' }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 30, fontWeight: 800, color: '#F0F4FF' }}>{risk}</span>
            <span style={{ color: '#64748B', fontSize: 13 }}>/ 100</span>
            <Badge color={riskTone}>{riskLevel} RISK</Badge>
          </div>

          {(ai.data?.analysis?.recommendations ?? []).map((rec, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 10,
                fontSize: 13,
                color: '#94A3B8',
                lineHeight: 1.5,
              }}
            >
              {rec}
            </div>
          ))}
          {!ai.data && (
            <p style={{ color: '#64748B', fontSize: 13 }}>Analyzing your portfolio…</p>
          )}
        </Card>

        {/* Allocation */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Allocation</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <PieChart width={130} height={130}>
              <Pie data={alloc.length ? alloc : [{ name: 'Cash', value: 1, color: '#475569' }]} cx={60} cy={60} innerRadius={38} outerRadius={58} dataKey="value" paddingAngle={2}>
                {alloc.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {alloc.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>No positions yet — start a bot to build allocation.</p>
              ) : (
                alloc.slice(0, 6).map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ color: '#94A3B8', width: 48 }}>{d.name}</span>
                    <span style={{ color: '#F0F4FF', fontWeight: 600, fontFamily: 'JetBrains Mono', marginLeft: 'auto' }}>
                      {allocTotal ? Math.round((d.value / allocTotal) * 100) : 0}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }} className="hero-grid">
        {/* Market overview */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Market Overview</p>
          {(markets.data?.markets ?? []).map((m) => {
            const live = prices[m.symbol] ?? m.price ?? 0
            const hist = m.history
            const up = hist.length >= 2 && hist[hist.length - 1] >= hist[0]
            return (
              <div
                key={m.symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '9px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ width: 44, fontWeight: 700, fontSize: 13, color: '#F0F4FF', fontFamily: 'JetBrains Mono' }}>
                  {m.symbol.replace('USDT', '')}
                </span>
                <span style={{ color: '#94A3B8', fontSize: 13, fontFamily: 'JetBrains Mono', flex: 1 }}>
                  {fmtPrice(live)}
                </span>
                {m.simulated && <Badge color="#F59E0B">SIM</Badge>}
                <Sparkline data={hist} color={up ? '#10B981' : '#EF4444'} />
              </div>
            )
          })}
        </Card>

        {/* Recent activity */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Recent Activity</p>
          {activity.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>No activity yet.</p>
          ) : (
            activity.slice(0, 7).map((a, i) => (
              <div key={a.id} style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.tone, marginTop: 5 }} />
                  {i < activity.slice(0, 7).length - 1 && (
                    <span style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', minHeight: 22 }} />
                  )}
                </div>
                <div style={{ paddingBottom: 14, flex: 1 }}>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600 }}>{a.title}</p>
                  <p style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{a.sub}</p>
                  <p style={{ color: '#334155', fontSize: 10, marginTop: 3 }}>{fmtTime(a.time)}</p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
