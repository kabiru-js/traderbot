import { api, type AdminStats, type AdminSystem, type AdminUser, type Tx } from '../api'
import { Badge, Card, ErrorBox, PageTitle, fmtMoney, fmtTime, useFetch } from './ui'

export default function AdminTab({ tick }: { tick: number }) {
  const stats = useFetch<AdminStats>(() => api.adminStats(), [tick])
  const users = useFetch<{ users: AdminUser[] }>(() => api.adminUsers(), [])
  const transactions = useFetch<{ transactions: (Tx & { email: string; name: string })[] }>(
    () => api.adminTransactions(),
    [],
  )
  const system = useFetch<AdminSystem>(() => api.adminSystem(), [])

  const s = stats.data
  const cards = [
    { label: 'Users', value: s?.users ?? 0 },
    { label: 'Active Bots', value: s?.activeBots ?? 0 },
    { label: 'Total AUM', value: fmtMoney(s?.totalAumUsd ?? 0) },
    { label: 'Deposits', value: fmtMoney(s?.totalDepositsUsd ?? 0) },
    { label: 'Withdrawals', value: fmtMoney(s?.totalWithdrawalsUsd ?? 0) },
    { label: 'Total Trades', value: s?.totalTrades ?? 0 },
  ]

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Admin</span> Dashboard
          </>
        }
        sub="User management, analytics, transaction monitoring, and system health."
      />
      {stats.error && <ErrorBox message={stats.error} />}
      {system.data && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <Badge color="#0EA5E9">MARKET FEED: {system.data.marketFeed.toUpperCase()}</Badge>
          <Badge color="#10B981">DB: {system.data.db.toUpperCase()}</Badge>
          <Badge color="#94A3B8">UPTIME: {(system.data.uptimeSec / 60).toFixed(1)}m</Badge>
          <Badge color="#94A3B8">MEM: {system.data.memoryMb} MB</Badge>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {cards.map((c) => (
          <Card key={c.label}>
            <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
              {c.label.toUpperCase()}
            </p>
            <p style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>
              {c.value}
            </p>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Users</p>
          {(users.data?.users ?? []).length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>Loading…</p>
          ) : (
            (users.data?.users ?? []).slice(0, 15).map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name}
                  </p>
                  <p style={{ color: '#475569', fontSize: 11 }}>{u.email}</p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge color={u.role === 'admin' ? '#8B5CF6' : '#64748B'}>{u.role.toUpperCase()}</Badge>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600 }}>
                    {fmtMoney(u.balance_usd)}
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Recent Transactions
          </p>
          {(transactions.data?.transactions ?? []).length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>Loading…</p>
          ) : (
            (transactions.data?.transactions ?? []).slice(0, 15).map((t) => (
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
                <div>
                  <p style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 600 }}>
                    {t.email} <span style={{ color: '#475569', fontWeight: 400 }}>· {t.type}</span>
                  </p>
                  <p style={{ color: '#475569', fontSize: 10 }}>{fmtTime(t.created_at)}</p>
                </div>
                <p
                  style={{
                    color: t.amount >= 0 ? '#10B981' : '#EF4444',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {fmtMoney(t.amount)}
                </p>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
