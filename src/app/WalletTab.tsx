import { useState } from 'react'
import { api, type Wallet } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GradientButton,
  PageTitle,
  fmtMoney,
  fmtTime,
  inputStyle,
  useFetch,
} from './ui'
import CryptoDepositCard from './CryptoDepositCard'

export default function WalletTab({ tick }: { tick: number }) {
  const { data, error, loading, refresh } = useFetch<Wallet>(() => api.wallet(), [tick])
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const deposit = async () => {
    setFormError(null)
    setBusy(true)
    try {
      const res = await api.deposit(Number(amount))
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
      } else {
        refresh()
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const tx = data?.transactions ?? []

  return (
    <div>
      <PageTitle title={<>Wallet</>} sub="Add funds and track every movement in your account ledger." />
      {error && <ErrorBox message={error} />}
      {formError && <ErrorBox message={formError} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        <Card>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            AVAILABLE BALANCE
          </p>
          <p style={{ fontFamily: 'Outfit', fontSize: 34, fontWeight: 700, color: '#F0F4FF' }}>
            {fmtMoney(data?.balance ?? 0)}
          </p>
          <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
            {loading ? 'Loading…' : 'Updates in real time as bots realize PnL.'}
          </p>
        </Card>
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Add money
          </p>
          <Field label="Amount (USD)">
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <GradientButton onClick={deposit} disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Processing…' : 'Deposit funds'}
          </GradientButton>
          <p style={{ color: '#475569', fontSize: 11, marginTop: 10 }}>
            Demo mode credits instantly. Stripe checkout is used when payment keys are configured.
          </p>
        </Card>
      </div>

      <CryptoDepositCard tick={tick} />

      <Card style={{ marginTop: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          Transaction history
        </p>
        {tx.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13 }}>No transactions yet.</p>
        ) : (
          tx.slice(0, 20).map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Badge color={t.type === 'deposit' ? '#0EA5E9' : '#8B5CF6'}>
                  {t.type.toUpperCase()}
                </Badge>
                <div>
                  <p style={{ color: '#94A3B8', fontSize: 12 }}>{t.reference ?? '—'}</p>
                  <p style={{ color: '#475569', fontSize: 10 }}>{fmtTime(t.created_at)}</p>
                </div>
              </div>
              <p
                style={{
                  color: t.amount >= 0 ? '#10B981' : '#EF4444',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {fmtMoney(t.amount)}
              </p>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
