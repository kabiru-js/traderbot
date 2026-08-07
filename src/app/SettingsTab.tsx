import { useState } from 'react'
import { api, type ExchangeAccount, type Profile } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GhostButton,
  GradientButton,
  PageTitle,
  fmtTime,
  inputStyle,
  useFetch,
} from './ui'

const EXCHANGES = ['binance', 'bybit', 'kraken', 'okx', 'coinbase']

export default function SettingsTab({ tick }: { tick: number }) {
  const profile = useFetch<{ profile: Profile }>(() => api.profile(), [tick])
  const exchanges = useFetch<{ accounts: ExchangeAccount[] }>(() => api.exchanges(), [])

  const [name, setName] = useState('')
  const [verifyLink, setVerifyLink] = useState<string | null>(null)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null)
  const [twoFaUrl, setTwoFaUrl] = useState<string | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // exchange form
  const [ex, setEx] = useState('binance')
  const [exLabel, setExLabel] = useState('')
  const [exKey, setExKey] = useState('')
  const [exSecret, setExSecret] = useState('')

  const p = profile.data?.profile

  const saveName = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.updateProfile(name.trim() || p?.name || '')
      profile.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const sendVerification = async () => {
    setError(null)
    setVerifyLink(null)
    setVerifyMsg(null)
    try {
      const res = await api.resendVerification()
      if (res.alreadyVerified) setVerifyMsg('Email already verified ✓')
      else if (res.devLink) setVerifyLink(res.devLink)
      else setVerifyMsg('Verification email sent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const setup2fa = async () => {
    setError(null)
    try {
      const res = await api.setup2fa()
      setTwoFaSecret(res.secret)
      setTwoFaUrl(res.otpauthUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const enable2fa = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.enable2fa(twoFaCode.trim())
      setTwoFaSecret(null)
      setTwoFaUrl(null)
      setTwoFaCode('')
      profile.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const disable2fa = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.disable2fa(twoFaCode.trim())
      setTwoFaCode('')
      profile.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const connectExchange = async () => {
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

  const removeExchange = async (id: string) => {
    try {
      await api.deleteExchange(id)
      exchanges.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  return (
    <div>
      <PageTitle
        title={
          <>
            Settings & <span className="gradient-text">Security</span>
          </>
        }
        sub="Manage your profile, two-factor authentication, and exchange connections."
      />
      {error && <ErrorBox message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        {/* Profile */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Profile
          </p>
          <Field label="Name">
            <input
              style={inputStyle}
              defaultValue={p?.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: 'block', color: '#64748B', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Email
            </span>
            <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600 }}>{p?.email}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <Badge color={p?.emailVerified ? '#10B981' : '#F59E0B'}>
                {p?.emailVerified ? 'EMAIL VERIFIED' : 'NOT VERIFIED'}
              </Badge>
              <Badge color={p?.role === 'admin' ? '#8B5CF6' : '#64748B'}>
                {p?.role?.toUpperCase() ?? 'USER'}
              </Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GradientButton onClick={saveName} disabled={busy} style={{ flex: 1 }}>
              Save profile
            </GradientButton>
            {!p?.emailVerified && (
              <GhostButton onClick={sendVerification} style={{ flex: 1 }}>
                Verify email
              </GhostButton>
            )}
          </div>
          {verifyLink && (
            <p style={{ color: '#F59E0B', fontSize: 12, marginTop: 10, wordBreak: 'break-all' }}>
              Demo link: {verifyLink}
            </p>
          )}
          {verifyMsg && (
            <p style={{ color: '#10B981', fontSize: 12, marginTop: 10 }}>{verifyMsg}</p>
          )}
        </Card>

        {/* 2FA */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Two-Factor Authentication
          </p>
          <Badge color={p?.twoFactorEnabled ? '#10B981' : '#64748B'}>
            {p?.twoFactorEnabled ? '2FA ENABLED' : '2FA DISABLED'}
          </Badge>
          {!p?.twoFactorEnabled ? (
            <div style={{ marginTop: 14 }}>
              {!twoFaSecret ? (
                <p style={{ color: '#64748B', fontSize: 13, marginBottom: 14 }}>
                  Add an extra layer of protection. You'll need an authenticator app
                  (Google Authenticator, Authy, etc.).
                </p>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
                    Scan this with your authenticator app, or enter the secret manually:
                  </p>
                  <p
                    style={{
                      fontFamily: 'JetBrains Mono',
                      fontSize: 13,
                      color: '#F0F4FF',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      wordBreak: 'break-all',
                      marginBottom: 8,
                    }}
                  >
                    {twoFaSecret}
                  </p>
                  {twoFaUrl && (
                    <a
                      href={twoFaUrl}
                      style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                    >
                      Open in authenticator →
                    </a>
                  )}
                </div>
              )}
              {!twoFaSecret ? (
                <GradientButton onClick={setup2fa}>Set up 2FA</GradientButton>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    style={inputStyle}
                    placeholder="6-digit code"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                  />
                  <GradientButton onClick={enable2fa} disabled={busy}>
                    Enable
                  </GradientButton>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <input
                style={inputStyle}
                placeholder="6-digit code"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
              />
              <GhostButton onClick={disable2fa} disabled={busy} style={{ color: '#EF4444' }}>
                Disable
              </GhostButton>
            </div>
          )}
        </Card>
      </div>

      {/* Exchanges */}
      <Card style={{ marginTop: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Exchange Connections
        </p>
        <p style={{ color: '#64748B', fontSize: 12, marginBottom: 14 }}>
          API keys are encrypted at rest (AES-256-GCM) and never returned. Trading remains
          paper-only until live execution is enabled.
        </p>
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
          <GradientButton onClick={connectExchange} disabled={busy} style={{ height: 42 }}>
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
                  onClick={() => removeExchange(a.id)}
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
      </Card>
    </div>
  )
}
