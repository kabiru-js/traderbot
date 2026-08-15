import { api, type Tx } from '../api'
import { Badge, Card, ErrorBox, GhostButton, PageTitle, fmtMoney, useFetch } from './ui'

export default function ReportsPage({ tick }: { tick: number }) {
  const wallet = useFetch<{ balance: number; transactions: Tx[] }>(() => api.wallet(), [tick])
  const portfolio = useFetch<{ totalPnl: number; trades: { id: string; side: string; price: number; qty: number; pnl_usd: number | null; created_at: string }[] }>(
    () => api.portfolio(),
    [tick],
  )

  const tx = wallet.data?.transactions ?? []
  const trades = portfolio.data?.trades ?? []
  const totalDeposits = tx.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawals = tx.filter((t) => t.type === 'withdraw').reduce((s, t) => s - t.amount, 0)

  const csvRows: (string | number)[][] = [
    ['Date', 'Type', 'Amount', 'Reference'],
    ...tx.map((t) => [t.created_at, t.type, t.amount, t.reference ?? '']),
  ]
  const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

  const tradesCsvRows: (string | number)[][] = [
    ['Date', 'Side', 'Price', 'Qty', 'PnL'],
    ...trades.map((t) => [t.created_at, t.side, t.price, t.qty, t.pnl_usd ?? '']),
  ]
  const tradesCsv = tradesCsvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">Reports</span>
          </>
        }
        sub="Export your portfolio documentation at any time."
      />
      {wallet.error && <ErrorBox message={wallet.error} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Available Balance', value: fmtMoney(wallet.data?.balance ?? 0) },
          { label: 'Total P&L', value: `${(portfolio.data?.totalPnl ?? 0) >= 0 ? '+' : ''}${fmtMoney(portfolio.data?.totalPnl ?? 0)}`, tone: (portfolio.data?.totalPnl ?? 0) >= 0 ? '#10B981' : '#EF4444' },
          { label: 'Total Deposits', value: fmtMoney(totalDeposits) },
          { label: 'Total Withdrawals', value: fmtMoney(totalWithdrawals) },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {c.label}
            </p>
            <p style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, color: c.tone ?? '#F0F4FF' }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Transaction History</p>
          <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{tx.length} records</p>
          <GhostButton onClick={() => download('transactions.csv', csv)}>Export CSV</GhostButton>
        </Card>
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Trade History</p>
          <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>{trades.length} records</p>
          <GhostButton onClick={() => download('trades.csv', tradesCsv)}>Export CSV</GhostButton>
        </Card>
      </div>

      <Card style={{ marginTop: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Available statements</p>
        {[
          { label: 'Portfolio Performance', desc: 'Equity curve and P&L summary', ready: true },
          { label: 'Asset Allocation', desc: 'Current holdings breakdown', ready: true },
          { label: 'Risk Report', desc: 'AI risk score and recommendations', ready: true },
          { label: 'PDF Export', desc: 'Institutional-grade PDF statements', ready: false },
        ].map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '11px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div>
              <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600 }}>{r.label}</p>
              <p style={{ color: '#64748B', fontSize: 12 }}>{r.desc}</p>
            </div>
            <Badge color={r.ready ? '#10B981' : '#475569'}>{r.ready ? 'AVAILABLE' : 'SOON'}</Badge>
          </div>
        ))}
      </Card>
    </div>
  )
}
