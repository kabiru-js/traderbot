import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, type CryptoDeposit } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GradientButton,
  inputStyle,
  useFetch,
} from './ui'

const statusTone = (s: string) =>
  s === 'confirmed' ? '#10B981' : s === 'confirming' ? '#F59E0B' : '#0EA5E9'

export default function CryptoDepositCard({ tick }: { tick: number }) {
  const { data, refresh } = useFetch<{ deposits: CryptoDeposit[] }>(() => api.cryptoDeposits(), [tick])
  const [amount, setAmount] = useState('500')
  const [created, setCreated] = useState<CryptoDeposit | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deposits = data?.deposits ?? []
  const active = created ?? deposits.find((d) => d.status !== 'confirmed') ?? deposits[0] ?? null

  const create = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await api.cryptoDeposit(Number(amount))
      setCreated(res.deposit)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const sent = async () => {
    if (!active) return
    setError(null)
    setBusy(true)
    try {
      await api.simulateCryptoTransfer(active.id)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Card>
      <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Crypto Deposit <span style={{ color: '#64748B', fontWeight: 400 }}>· USDC on Ethereum</span>
      </p>
      <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>
        {active?.demo
          ? 'Demo mode — send to the address below and we auto-confirm shortly after you submit.'
          : 'Send USDC to our platform address — deposits auto-confirm on-chain.'}
      </p>
      {error && <ErrorBox message={error} />}

      {!active || (active.status === 'confirmed' && !created) ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', maxWidth: 420 }}>
          <Field label="Amount (USDC)">
            <input
              style={inputStyle}
              type="number"
              min={1}
              max={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <GradientButton onClick={create} disabled={busy} style={{ height: 42 }}>
            {busy ? '…' : 'Generate deposit address'}
          </GradientButton>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ background: '#fff', padding: 10, borderRadius: 10 }}>
            <QRCodeSVG value={active.qrPayload} size={132} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Badge color={statusTone(active.status)}>{active.status.toUpperCase()}</Badge>
              {active.demo && <Badge color="#F59E0B">DEMO</Badge>}
              <span style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 15, fontFamily: 'Outfit' }}>
                Send {active.amountUsd.toFixed(2)} USDC
              </span>
            </div>
            <p style={{ color: '#475569', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Network: Ethereum (ERC-20) · Never send other assets
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <code
                style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: 12,
                  color: '#F0F4FF',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {active.address}
              </code>
              <button
                onClick={copy}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#94A3B8',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href={active.deepLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                  color: '#fff',
                  padding: '9px 16px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open in wallet →
              </a>
              {active.status === 'pending' && (
                <button
                  onClick={sent}
                  disabled={busy}
                  style={{
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10B981',
                    borderRadius: 9,
                    padding: '9px 16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  I've sent the funds
                </button>
              )}
            </div>
            {active.status === 'confirming' && (
              <p style={{ color: '#F59E0B', fontSize: 12, marginTop: 10 }}>
                Detecting transaction on-chain… auto-confirms in ~30 seconds.
              </p>
            )}
            {active.status === 'confirmed' && (
              <p style={{ color: '#10B981', fontSize: 12, marginTop: 10 }}>
                ✓ Confirmed — {active.amountUsd.toFixed(2)} USDC credited to your wallet.
              </p>
            )}
          </div>
        </div>
      )}

      {deposits.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent crypto deposits
          </p>
          {deposits.slice(0, 5).map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono' }}>
                {d.amountUsd.toFixed(2)} USDC
              </span>
              <span style={{ color: '#475569', fontFamily: 'JetBrains Mono' }}>{d.address.slice(0, 12)}…</span>
              <Badge color={statusTone(d.status)}>{d.status.toUpperCase()}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
