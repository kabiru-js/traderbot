import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  Bell,
  CandlestickChart,
  Coins,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  PieChart,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'

export type PageId =
  | 'overview'
  | 'portfolio'
  | 'wallet'
  | 'assets'
  | 'markets'
  | 'ai'
  | 'strategies'
  | 'exchanges'
  | 'transactions'
  | 'alerts'
  | 'reports'
  | 'settings'
  | 'help'
  | 'admin'

interface NavItem {
  id: PageId
  label: string
  icon: ReactNode
}

const MAIN_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'portfolio', label: 'Portfolio', icon: <PieChart size={17} /> },
  { id: 'wallet', label: 'Wallet', icon: <Wallet size={17} /> },
  { id: 'assets', label: 'Assets', icon: <Coins size={17} /> },
  { id: 'markets', label: 'Markets', icon: <CandlestickChart size={17} /> },
  { id: 'ai', label: 'AI Intelligence', icon: <Sparkles size={17} /> },
  { id: 'strategies', label: 'Trading', icon: <CandlestickChart size={17} /> },
  { id: 'exchanges', label: 'Exchanges', icon: <Plug size={17} /> },
  { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight size={17} /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={17} /> },
  { id: 'reports', label: 'Reports', icon: <FileText size={17} /> },
]

const BOTTOM_NAV: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  { id: 'help', label: 'Help & Support', icon: <LifeBuoy size={17} /> },
]

const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Your portfolio at a glance' },
  portfolio: { title: 'Portfolio', sub: 'Allocation, positions, and performance' },
  wallet: { title: 'Wallet', sub: 'Deposit funds and track your balance' },
  assets: { title: 'Assets', sub: 'Monitor and manage your holdings' },
  markets: { title: 'Markets', sub: 'Live prices and market context' },
  ai: { title: 'AI Intelligence', sub: 'Analysis, risk, and recommendations' },
  strategies: { title: 'Trading', sub: 'Live charts and automated trading' },
  exchanges: { title: 'Exchange Connections', sub: 'Secure API connections' },
  transactions: { title: 'Transactions', sub: 'Complete account history' },
  alerts: { title: 'Alerts', sub: 'Price alerts and notifications' },
  reports: { title: 'Reports', sub: 'Export portfolio documentation' },
  settings: { title: 'Settings', sub: 'Profile and security' },
  help: { title: 'Help & Support', sub: 'Guides and resources' },
  admin: { title: 'Admin', sub: 'Platform operations' },
}

function NavButton({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: (id: PageId) => void
}) {
  return (
    <button
      onClick={() => onNavigate(item.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: active ? '1px solid rgba(14,165,233,0.12)' : '1px solid transparent',
        background: active ? 'rgba(14,165,233,0.08)' : 'transparent',
        color: active ? '#0EA5E9' : '#94A3B8',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'Inter',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#F0F4FF'
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.color = '#94A3B8'
      }}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  )
}

export function Sidebar({
  page,
  onNavigate,
  isAdmin,
  onExit,
}: {
  page: PageId
  onNavigate: (id: PageId) => void
  isAdmin: boolean
  onExit: () => void
}) {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: '#080D1A',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            boxShadow: '0 0 18px rgba(14,165,233,0.35)',
          }}
        >
          ⬡
        </div>
        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 17, color: '#F0F4FF' }}>
          NeuralVault
        </span>
      </div>

      <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {MAIN_NAV.map((item) => (
          <NavButton key={item.id} item={item} active={page === item.id} onNavigate={onNavigate} />
        ))}
      </nav>

      <div style={{ padding: '8px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {BOTTOM_NAV.map((item) => (
          <NavButton key={item.id} item={item} active={page === item.id} onNavigate={onNavigate} />
        ))}
        {isAdmin && (
          <NavButton
            item={{ id: 'admin', label: 'Admin', icon: <ShieldCheck size={17} /> }}
            active={page === 'admin'}
            onNavigate={onNavigate}
          />
        )}
        <button
          onClick={onExit}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid transparent',
            background: 'transparent',
            color: '#475569',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Inter',
            textAlign: 'left',
          }}
        >
          ← Back to site
        </button>
      </div>
    </aside>
  )
}

export function TopBar({
  page,
  search,
  onSearch,
  marketFeed,
  unread,
  userName,
  isDemo,
  onNotifications,
  onLogout,
}: {
  page: PageId
  search: string
  onSearch: (q: string) => void
  marketFeed: string
  unread: number
  userName: string
  isDemo?: boolean
  onNotifications: () => void
  onLogout: () => void
}) {
  const t = PAGE_TITLES[page]
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(6,10,20,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <div style={{ minWidth: 200 }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 17, fontWeight: 700, color: '#F0F4FF', lineHeight: 1.2 }}>
            {t.title}
          </h1>
          <p style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{t.sub}</p>
        </div>

        <div style={{ flex: 1, maxWidth: 440, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search assets, transactions, strategies..."
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 9,
              padding: '9px 12px 9px 34px',
              color: '#F0F4FF',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'Inter',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
          {isDemo && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#10B981',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 6,
                padding: '3px 8px',
              }}
            >
              DEMO
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: marketFeed === 'live' ? '#10B981' : '#F59E0B',
                boxShadow: `0 0 8px ${marketFeed === 'live' ? '#10B981' : '#F59E0B'}`,
              }}
            />
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>
              {marketFeed === 'live' ? 'Markets Operational' : 'Markets Simulated'}
            </span>
          </div>

          <button
            onClick={onNotifications}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
            }}
            title="Alerts"
          >
            <Bell size={17} />
            {unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -6,
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: '1px 5px',
                }}
              >
                {unread}
              </span>
            )}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '4px 8px',
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {(userName || 'U').slice(0, 1).toUpperCase()}
            </div>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </span>
          </div>

          <button
            onClick={onLogout}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#94A3B8',
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'Inter',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
