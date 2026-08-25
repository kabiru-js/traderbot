import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { disconnectSocket, getSocket } from '../socket'
import { api } from '../api'
import { Sidebar, TopBar, type PageId } from './shell'
import OverviewPage from './OverviewPage'
import PortfolioPage from './PortfolioPage'
import AssetsPage from './AssetsPage'
import MarketsPage from './MarketsPage'
import AIPage from './AIPage'
import TransactionsPage from './TransactionsPage'
import ReportsPage from './ReportsPage'
import HelpPage from './HelpPage'
import TradingPage from './TradingPage'
import WalletTab from './WalletTab'
import AlertsTab from './AlertsTab'
import SettingsTab from './SettingsTab'
import AdminTab from './AdminTab'
import ExchangeConnections from './ExchangeConnections'
import { Card, PageTitle, useFetch } from './ui'

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

export default function AppArea({ onExit }: { onExit: () => void }) {
  const { user, logout } = useAuth()
  const [page, setPage] = useState<PageId>('overview')
  const [search, setSearch] = useState('')
  const live = useLive()
  const health = useFetch<{ status: string; demoMode: boolean; marketFeed: string }>(() => api.health(), [])
  const notif = useFetch<{ unread: number }>(() => api.notifications(), [live.tick])

  const handleLogout = () => {
    disconnectSocket()
    logout()
    onExit()
  }

  const navigate = (id: PageId) => {
    setPage(id)
    window.scrollTo({ top: 0 })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060A14' }}>
      <Sidebar
        page={page}
        onNavigate={navigate}
        isAdmin={user?.role === 'admin'}
        onExit={onExit}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <TopBar
          page={page}
          search={search}
          onSearch={setSearch}
          marketFeed={health.data?.marketFeed ?? 'live'}
          unread={notif.data?.unread ?? 0}
          userName={user?.name ?? user?.username ?? ''}
          onNotifications={() => navigate('alerts')}
          onLogout={handleLogout}
        />
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' }}>
          {page === 'overview' && <OverviewPage tick={live.tick} prices={live.prices} userName={user?.name ?? ''} onAddFunds={() => navigate('wallet')} />}
          {page === 'portfolio' && <PortfolioPage tick={live.tick} prices={live.prices} />}
          {page === 'wallet' && <WalletTab tick={live.tick} />}
          {page === 'assets' && <AssetsPage tick={live.tick} prices={live.prices} search={search} />}
          {page === 'markets' && <MarketsPage tick={live.tick} prices={live.prices} search={search} />}
          {page === 'ai' && <AIPage tick={live.tick} />}
          {page === 'strategies' && <TradingPage tick={live.tick} prices={live.prices} onAddFunds={() => navigate('wallet')} />}
          {page === 'exchanges' && (
            <>
              <PageTitle
                title={
                  <>
                    <span className="gradient-text">Exchanges</span>
                  </>
                }
                sub="Secure API connections to supported platforms."
              />
              <Card>
                <ExchangeConnections />
              </Card>
            </>
          )}
          {page === 'transactions' && <TransactionsPage tick={live.tick} search={search} />}
          {page === 'alerts' && <AlertsTab tick={live.tick} />}
          {page === 'reports' && <ReportsPage tick={live.tick} />}
          {page === 'settings' && <SettingsTab tick={live.tick} />}
          {page === 'help' && <HelpPage />}
          {page === 'admin' && <AdminTab tick={live.tick} />}
        </main>
      </div>
    </div>
  )
}
