import { useState } from 'react'
import { api, type ExchangeAccount } from '../api'
import { ErrorBox, Field, GradientButton, inputStyle, useFetch } from './ui'
import { fmtTime } from './ui'

const EXCHANGES = ['binance', 'bybit', 'kraken', 'okx', 'coinbase']

export default function ExchangeConnections() {
  const exchanges = useFetch<{ accounts: ExchangeAccount[] }>(() => api.exchanges(), [])
  const [ex, setEx] = useState('binance')
  const [exLabel, setExLabel] = useState('')
  const [exKey, setExKey] = useState('')
  const [exSecret, setExSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.connectExchange({
        exchange: ex,
        label: exLabel || undefined,
        apiKey: exKey.trim(),
        apiSecret: exSecret.trim(),
      })
      setExKey('')
      setExSecret('')
      exchanges.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.deleteExchange(id)
      exchanges.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  return (
    <div>
      <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Exchange Connections
      </p>
      <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>
        API keys are encrypted at rest (AES-256-GCM) and never displayed. Trading remains
        paper-only until live execution is enabled.
      </p>
      {error && <ErrorBox message={error} />}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
          gap: 10,
          alignItems: 'end',
        }}
        className="hero-grid"
      >
        <Field label="Exchange">
          <select style={inputStyle} value={ex} onChange={(e) => setEx(e.target.value)}>
            {EXCHANGES.map((x) => (
              <option key={x} value={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Label">
          <input style={inputStyle} value={exLabel} onChange={(e) => setExLabel(e.target.value)} placeholder="Main" />
        </Field>
        <Field label="API key">
          <input style={inputStyle} value={exKey} onChange={(e) => setExKey(e.target.value)} placeholder="abc123…" />
        </Field>
        <Field label="API secret">
          <input
            style={inputStyle}
            type="password"
            value={exSecret}
            onChange={(e) => setExSecret(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <GradientButton onClick={connect} disabled={busy} style={{ height: 42 }}>
          Connect
        </GradientButton>
      </div>
      <div style={{ marginTop: 12 }}>
        {(exchanges.data?.accounts ?? []).length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13 }}>No exchange connections yet.</p>
        ) : (
          (exchanges.data?.accounts ?? []).map((a) => (
            <div
              key={a.id}
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
                  {a.exchange[0].toUpperCase() + a.exchange.slice(1)}
                  {a.label ? ` · ${a.label}` : ''}
                </p>
                <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                  {a.apiKeyMasked} · {fmtTime(a.createdAt)}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#EF4444',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
