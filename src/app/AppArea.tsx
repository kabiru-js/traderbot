import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { disconnectSocket, getSocket } from '../socket'
import DashboardTab from './DashboardTab'
import BotsTab from './BotsTab'
import WalletTab from './WalletTab'
import AlertsTab from './AlertsTab'
import SettingsTab from './SettingsTab'
import AdminTab from './AdminTab'

/** Subscribes to the user's real-time events and exposes a refresh tick. */
export function useLive(): { tick: number; prices: Record<string, number> } {
  const [tick, setTick] = useState(0)
  const [prices, setPrices] = useState<Record<string, number>>({})

  useEffect(() => {
    const s = getSocket()
    const bump = () => setTick((t) => t + 1)
    const onPrice = (p: { symbol: string; price: number }) =>
      setPrices((prev) => ({ ...prev, [p.symbol]: p.price }))

    s.on('wallet:update', bump)
    s.on('bot:update', bump)
    s.on('trade:filled', bump)
    s.on('notification', bump)
    s.on('price:update', onPrice)
    return () => {
      s.off('wallet:update', bump)
      s.off('bot:update', bump)
      s.off('trade:filled', bump)
      s.off('notification', bump)
      s.off('price:update', onPrice)
    }
  }, [])

  return { tick, prices }
}

type Tab = 'dashboard' | 'bots' | 'wallet' | 'alerts' | 'settings' | 'admin'

export default function AppArea({ onExit }: { onExit: () => void }) {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('dashboard')
  const live = useLive()

  const handleLogout = () => {
    disconnectSocket()
    logout()
    onExit()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'bots', label: 'Bots' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'settings', label: 'Settings' },
    ...(user?.role === 'admin' ? [{ id: 'admin' as Tab, label: 'Admin' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#060A14', paddingBottom: 60 }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(6,10,20,0.92)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onExit}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
            >
              ⬡
            </div>
            <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 18, color: '#F0F4FF' }}>
              NeuralVault
            </span>
          </div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: tab === t.id ? 'rgba(14,165,233,0.12)' : 'transparent',
                  border: 'none',
                  color: tab === t.id ? '#0EA5E9' : '#94A3B8',
                  cursor: 'pointer',
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'Inter',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>
              {user?.name} · {user?.email}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94A3B8',
                padding: '7px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'Inter',
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 0' }}>
        {tab === 'dashboard' && <DashboardTab tick={live.tick} prices={live.prices} />}
        {tab === 'bots' && <BotsTab tick={live.tick} prices={live.prices} />}
        {tab === 'wallet' && <WalletTab tick={live.tick} />}
        {tab === 'alerts' && <AlertsTab tick={live.tick} />}
        {tab === 'settings' && <SettingsTab tick={live.tick} />}
        {tab === 'admin' && <AdminTab tick={live.tick} />}
      </main>
    </div>
  )
}
