import { useState, type FormEvent } from 'react'
import { TwoFactorRequiredError, useAuth } from '../store'
import { disconnectSocket } from '../socket'
import { Card, ErrorBox, Field, GhostButton, GradientButton, inputStyle } from './ui'

export default function AuthPage() {
  const { login, signup, startDemo } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [awaitingCode, setAwaitingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      disconnectSocket()
      if (mode === 'signup') await signup(email, password, name, username || undefined)
      else await login(email, password, awaitingCode ? totpCode : undefined)
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setAwaitingCode(true)
        setError('Two-factor code required — enter the code from your authenticator app.')
      } else {
        setError(err instanceof Error ? err.message : 'Request failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const tryDemo = async () => {
    setError(null)
    setBusy(true)
    try {
      disconnectSocket()
      await startDemo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="grad-border">
          <Card style={{ padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 12px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  boxShadow: '0 0 24px rgba(14,165,233,0.4)',
                }}
              >
                ⬡
              </div>
              <h1 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700, color: '#F0F4FF' }}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h1>
              <p style={{ color: '#64748B', fontSize: 13, marginTop: 6 }}>
                {mode === 'signup'
                  ? 'Free in 2 minutes. Demo wallet included.'
                  : 'Log in to manage your bots and wallet.'}
              </p>
            </div>
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <Field label="Full name">
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Marcus Thompson"
                  />
                </Field>
              )}
              {mode === 'signup' && (
                <Field label="Username (optional)">
                  <input
                    style={inputStyle}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="marcus_btc"
                  />
                </Field>
              )}
              <Field label={mode === 'signup' ? 'Email' : 'Email or username'}>
                <input
                  style={inputStyle}
                  type={mode === 'signup' ? 'email' : 'text'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'signup' ? 'you@example.com' : 'you@example.com or username'}
                />
              </Field>
              <Field label="Password">
                <input
                  style={inputStyle}
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ characters"
                />
              </Field>
              {awaitingCode && (
                <Field label="Authenticator code">
                  <input
                    style={inputStyle}
                    inputMode="numeric"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                  />
                </Field>
              )}
              {error && <ErrorBox message={error} />}
              <GradientButton disabled={busy} style={{ width: '100%' }}>
                {busy
                  ? 'Please wait…'
                  : awaitingCode
                    ? 'Verify code'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Log in'}
              </GradientButton>
            </form>
            <p style={{ textAlign: 'center', color: '#475569', fontSize: 13, marginTop: 16 }}>
              {mode === 'signup' ? 'Already have an account? ' : "New to NeuralVault? "}
              <button
                onClick={() => {
                  setMode((m) => (m === 'signup' ? 'login' : 'signup'))
                  setError(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0EA5E9',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {mode === 'signup' ? 'Log in' : 'Create account'}
              </button>
            </p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 16 }}>
              <GhostButton onClick={tryDemo} disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Creating…' : 'Try demo account — $10,000 mock funds'}
              </GhostButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
