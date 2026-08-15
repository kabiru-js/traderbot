import { useState } from 'react'
import { api, type Trade, type Tx } from '../api'
import { Badge, Card, ErrorBox, PageTitle, fmtMoney, fmtPrice, fmtTime, useFetch } from './ui'

type Filter = 'All' | 'Deposits' | 'Withdrawals' | 'Trades' | 'Strategy'

const FILTERS: Filter[] = ['All', 'Deposits', 'Withdrawals', 'Trades', 'Strategy']

const mono = { fontFamily: 'JetBrains Mono' } as const

export default function TransactionsPage({
  tick,
  search,
}: {
  tick: number
  search: string
}) {
  const wallet = useFetch<{ balance: number; transactions: Tx[] }>(() => api.wallet(), [tick])
  const portfolio = useFetch<{ trades: Trade[] }>(() => api.portfolio(), [tick])
  const [filter, setFilter] = useState<Filter>('All')

  interface Row {
    key: string
    date: string
    type: string
    asset: string
    amount: string
    value: string
    id: string
    kind: string
  }
  const tx: Row[] = []

  for (const t of wallet.data?.transactions ?? []) {
    tx.push({
      key: `w-${t.id}`,
      date: t.created_at,
      type: t.type.toUpperCase(),
      asset: 'USDC',
      amount: `${t.amount >= 0 ? '+' : ''}${fmtMoney(t.amount)}`,
      value: fmtMoney(t.amount),
      id: t.id.slice(0, 8),
      kind: t.type === 'deposit' ? 'Deposits' : t.type === 'withdraw' ? 'Withdrawals' : 'Strategy',
    })
  }

  for (const t of portfolio.data?.trades ?? []) {
    tx.push({
      key: `t-${t.id}`,
      date: t.created_at,
      type: t.side,
      asset: t.symbol ?? '',
      amount: `${t.pnl_usd != null && t.pnl_usd >= 0 ? '+' : ''}${fmtMoney(t.pnl_usd ?? 0)}`,
      value: `${t.qty.toFixed(4)} @ ${fmtPrice(t.price)}`,
      id: t.id.slice(0, 8),
      kind: 'Trades',
    })
  }

  const rows = tx
    .filter((r) => filter === 'All' || r.kind === filter)
    .filter((r) => r.asset.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Transactions</span>
          </>
        }
        sub="Complete account history, private-banking style."
      />
      {wallet.error && <ErrorBox message={wallet.error} />}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.03)',
              border: filter === f ? '1px solid rgba(14,165,233,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: filter === f ? '#0EA5E9' : '#94A3B8',
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <Card style={{ padding: 8 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 0.8fr',
            gap: 10,
            padding: '10px 14px',
            color: '#475569',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          <span>Date</span>
          <span>Type</span>
          <span>Asset</span>
          <span>Amount</span>
          <span>Value</span>
          <span>ID</span>
        </div>
        {rows.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13, padding: 16 }}>No transactions match.</p>
        ) : (
          rows.slice(0, 30).map((r) => (
            <div
              key={r.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr 0.8fr',
                gap: 10,
                alignItems: 'center',
                padding: '11px 14px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#94A3B8' }}>{fmtTime(r.date)}</span>
              <span>
                <Badge color={r.type === 'DEPOSIT' ? '#10B981' : r.type === 'WITHDRAWAL' ? '#EF4444' : r.type === 'BUY' ? '#0EA5E9' : '#8B5CF6'}>
                  {r.type}
                </Badge>
              </span>
              <span style={{ color: '#F0F4FF', fontWeight: 600 }}>{r.asset}</span>
              <span style={{ ...mono, color: r.amount.startsWith('+') ? '#10B981' : '#EF4444' }}>{r.amount}</span>
              <span style={{ color: '#64748B', ...mono }}>{r.value}</span>
              <span style={{ color: '#334155', ...mono }}>{r.id}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
