import { useState } from 'react'
import { api, type Profile } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GhostButton,
  GradientButton,
  PageTitle,
  inputStyle,
  useFetch,
} from './ui'
import ExchangeConnections from './ExchangeConnections'

export default function SettingsTab({
  tick,
  onModeChanged,
}: {
  tick: number
  onModeChanged?: () => void
}) {
  const profile = useFetch<{ profile: Profile }>(() => api.profile(), [tick])

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [verifyLink, setVerifyLink] = useState<string | null>(null)
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null)
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null)
  const [twoFaUrl, setTwoFaUrl] = useState<string | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const p = profile.data?.profile

  const saveProfile = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.updateProfile(name.trim() || p?.name || '', username.trim() || undefined)
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

  const [modeBusy, setModeBusy] = useState(false)

  const toggleMode = async () => {
    setError(null)
    setModeBusy(true)
    try {
      const next = p?.mode === 'testnet' ? 'live' : 'testnet'
      await api.setMode(next)
      onModeChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setModeBusy(false)
    }
  }

  const isTestnet = p?.mode === 'testnet'

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

      {/* Testnet toggle */}
      <Card
        style={{
          marginBottom: 20,
          border: isTestnet ? '1px solid rgba(139,92,246,0.25)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F0F4FF', fontSize: 14, fontWeight: 700 }}>
              Testnet Mode
              {isTestnet && <Badge color="#8B5CF6">ACTIVE</Badge>}
            </p>
            <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
              {isTestnet
                ? 'You are on the testnet — mock money, real market data. Toggle off to return to your live wallet.'
                : 'Switch to a testnet wallet with mock funds to practice trading without risking real money.'}
            </p>
          </div>
          <button
            onClick={toggleMode}
            disabled={modeBusy}
            style={{
              background: isTestnet ? 'rgba(239,68,68,0.1)' : 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
              border: isTestnet ? '1px solid rgba(239,68,68,0.35)' : 'none',
              color: isTestnet ? '#EF4444' : '#fff',
              padding: '10px 18px',
              borderRadius: 9,
              cursor: modeBusy ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {modeBusy ? 'Switching…' : isTestnet ? 'Exit Testnet' : 'Enable Testnet'}
          </button>
        </div>
      </Card>

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
          <Field label="Username (login with this)">
            <input
              style={inputStyle}
              defaultValue={p?.username ?? ''}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="marcus_btc"
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
            <GradientButton onClick={saveProfile} disabled={busy} style={{ flex: 1 }}>
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

      <Card style={{ marginTop: 20 }}>
        <ExchangeConnections />
      </Card>
    </div>
  )
}
