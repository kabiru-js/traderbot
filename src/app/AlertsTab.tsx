import { useState } from 'react'
import { api, type Notification, type PriceAlert } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GradientButton,
  PageTitle,
  fmtPrice,
  fmtTime,
  inputStyle,
  useFetch,
} from './ui'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

export default function AlertsTab({ tick }: { tick: number }) {
  const notif = useFetch<{ notifications: Notification[]; unread: number }>(
    () => api.notifications(),
    [tick],
  )
  const alerts = useFetch<{ alerts: PriceAlert[] }>(() => api.alerts(), [tick])

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [direction, setDirection] = useState('above')
  const [targetPrice, setTargetPrice] = useState('100000')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAlert = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.createAlert({ symbol, direction, targetPrice: Number(targetPrice) })
      alerts.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const removeAlert = async (id: string) => {
    try {
      await api.deleteAlert(id)
      alerts.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const markRead = async (id: string) => {
    try {
      await api.markNotificationRead(id)
      notif.refresh()
    } catch {
      // ignore
    }
  }

  const notifications = notif.data?.notifications ?? []
  const alertList = alerts.data?.alerts ?? []

  return (
    <div>
      <PageTitle
        title={
          <>
            Alerts & <span className="gradient-text">Notifications</span>
          </>
        }
        sub="Security events and price alerts, delivered in real time."
      />
      {error && <ErrorBox message={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        {/* Notifications */}
        <Card>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600 }}>
              Notifications{' '}
              {(notif.data?.unread ?? 0) > 0 && (
                <Badge color="#0EA5E9">{notif.data?.unread} new</Badge>
              )}
            </p>
            {(notif.data?.unread ?? 0) > 0 && (
              <button
                onClick={() => api.markAllRead().then(() => notif.refresh())}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0EA5E9',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>No notifications yet.</p>
          ) : (
            notifications.slice(0, 12).map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: n.read ? 'default' : 'pointer',
                  opacity: n.read ? 0.6 : 1,
                }}
              >
                <Badge
                  color={
                    n.type === 'security'
                      ? '#EF4444'
                      : n.type === 'price_alert'
                        ? '#F59E0B'
                        : '#0EA5E9'
                  }
                >
                  {n.type.toUpperCase()}
                </Badge>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600 }}>{n.title}</p>
                  <p style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{n.body}</p>
                  <p style={{ color: '#334155', fontSize: 10, marginTop: 4 }}>{fmtTime(n.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Price alerts */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Price Alerts
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr auto',
              gap: 10,
              alignItems: 'end',
            }}
            className="hero-grid"
          >
            <Field label="Market">
              <select style={inputStyle} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('USDT', '/USDT')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="When price">
              <select style={inputStyle} value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="above">goes above</option>
                <option value="below">drops below</option>
              </select>
            </Field>
            <Field label="Target price">
              <input
                style={inputStyle}
                type="number"
                min={0.000001}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
            </Field>
            <GradientButton onClick={createAlert} disabled={busy} style={{ height: 42 }}>
              {busy ? '…' : 'Add Alert'}
            </GradientButton>
          </div>
          <div style={{ marginTop: 12 }}>
            {alertList.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: 13 }}>
                No alerts yet — the engine checks prices every 5 seconds.
              </p>
            ) : (
              alertList.map((a) => (
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
                      {a.symbol.replace('USDT', '/USDT')}{' '}
                      <span style={{ color: '#94A3B8', fontWeight: 400 }}>
                        {a.direction === 'above' ? '≥' : '≤'} {fmtPrice(a.target_price)}
                      </span>
                    </p>
                    <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      {a.triggered ? 'Triggered ✓' : 'Watching…'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeAlert(a.id)}
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
    </div>
  )
}
