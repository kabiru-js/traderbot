const TOKEN_KEY = 'nv_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) ?? {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...opts, headers })

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null)
      window.dispatchEvent(new Event('nv-unauthorized'))
    }
    let message = `Request failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────
export interface User {
  id: string
  email: string
  name: string
  role?: string
  username?: string
  isDemo?: boolean
}

export interface Profile {
  id: string
  email: string
  username: string | null
  name: string
  role: string
  demo: boolean
  mode: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
}

export interface Tx {
  id: string
  type: string
  amount: number
  reference: string | null
  created_at: string
}

export interface Wallet {
  balance: number
  transactions: Tx[]
}

export interface Bot {
  id: string
  symbol: string
  strategy: string
  capital: number
  status: string
  position_side: string | null
  position_size: number | null
  entry_price: number | null
  pnl_usd: number
  unrealized_pnl: number
  price: number | null
  simulated?: boolean
  created_at: string
}

export interface Trade {
  id: string
  symbol?: string
  side: string
  price: number
  qty: number
  pnl_usd: number | null
  fee?: number
  created_at: string
}

export interface Portfolio {
  balance: number
  totalPnl: number
  equity: { t: string; balance: number }[]
  openPositions: (Bot & { price: number | null; unrealized_pnl: number })[]
  trades: Trade[]
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface PriceAlert {
  id: string
  symbol: string
  target_price: number
  direction: string
  triggered: boolean
  created_at: string
}

export interface ExchangeAccount {
  id: string
  exchange: string
  label: string | null
  apiKeyMasked: string
  createdAt: string
}

export interface CryptoDeposit {
  id: string
  asset: string
  network: string
  address: string
  amountUsd: number
  status: string
  txHash: string | null
  createdAt: string
  qrPayload: string
  deepLink: string
  demo: boolean
}

export interface Market {
  symbol: string
  price: number | null
  simulated: boolean
  history: number[]
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketAnalysis {
  signal: string
  score: number
  volatility: number
  summary: string
}

export interface PortfolioAnalysis {
  riskScore: number
  summary: string
  recommendations: string[]
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  created_at: string
  email_verified_at: string | null
  two_factor_enabled: boolean
  balance_usd: number
  bot_count: number
  trade_count: number
}

export interface AdminStats {
  users: number
  activeBots: number
  totalAumUsd: number
  totalDepositsUsd: number
  totalWithdrawalsUsd: number
  totalTrades: number
}

export interface AdminSystem {
  uptimeSec: number
  memoryMb: number
  marketFeed: string
  activeBots: number
  db: string
  time: string
}

// ── API ───────────────────────────────────────────────────────────
export const api = {
  health: () => request<{ status: string; demoMode: boolean; marketFeed: string }>('/health'),

  // auth
  signup: (email: string, password: string, name: string, username?: string) =>
    request<{ user: User; token: string; emailVerification?: { pending: boolean; devLink?: string } }>(
      '/auth/signup',
      { method: 'POST', body: JSON.stringify({ email, password, name, username }) },
    ),
  login: (email: string, password: string, totpCode?: string) =>
    request<{ user?: User; token?: string; requiresTwoFactor?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpCode }),
    }),
  me: () => request<{ user: User }>('/auth/me'),
  authDemo: () => request<{ user: User; token: string; demo: boolean }>('/auth/demo', { method: 'POST' }),
  verifyEmail: (token: string) =>
    request<{ ok: boolean }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: () =>
    request<{ ok: boolean; devLink?: string; alreadyVerified?: boolean }>('/auth/resend-verification', {
      method: 'POST',
    }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; devLink?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  setup2fa: () => request<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' }),
  enable2fa: (code: string) =>
    request<{ twoFactorEnabled: boolean }>('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2fa: (code: string) =>
    request<{ twoFactorEnabled: boolean }>('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),

  // profile
  profile: () => request<{ profile: Profile }>('/profile'),
  updateProfile: (name: string, username?: string) =>
    request<{ profile: { id: string; email: string; username: string | null; name: string; role: string } }>(
      '/profile',
      { method: 'PATCH', body: JSON.stringify({ name, username }) },
    ),
  setMode: (mode: string) =>
    request<{ profile: { mode: string } }>('/profile/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  // wallet
  wallet: () => request<Wallet>('/wallet'),
  deposit: (amount: number) =>
    request<{ balance?: number; checkoutUrl?: string }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  withdraw: (amount: number) =>
    request<{ balance: number; reference: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  cryptoDeposit: (amount: number, network?: string) =>
    request<{ deposit: CryptoDeposit }>('/wallet/deposit/crypto', {
      method: 'POST',
      body: JSON.stringify({ amount, network }),
    }),
  cryptoDeposits: () => request<{ deposits: CryptoDeposit[] }>('/wallet/deposits'),
  simulateCryptoTransfer: (id: string) =>
    request<{ ok: boolean }>(`/wallet/deposits/${id}/simulate-transfer`, { method: 'POST' }),

  // bots
  bots: () => request<{ bots: Bot[] }>('/bots'),
  createBot: (input: { symbol: string; strategy: string; capital: number }) =>
    request<{ bot: Bot }>('/bots', { method: 'POST', body: JSON.stringify(input) }),
  startBot: (id: string) => request<{ bot: Bot }>(`/bots/${id}/start`, { method: 'POST' }),
  stopBot: (id: string) => request<{ bot: Bot }>(`/bots/${id}/stop`, { method: 'POST' }),
  portfolio: () => request<Portfolio>('/portfolio'),

  // markets + AI
  markets: () => request<{ markets: Market[] }>('/markets'),
  candles: (symbol: string, interval: string) =>
    request<{ candles: Candle[]; simulated: boolean }>(
      `/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(interval)}`,
    ),
  aiAnalysis: (symbol: string) =>
    request<{ symbol: string; analysis: MarketAnalysis }>(`/ai/analysis?symbol=${encodeURIComponent(symbol)}`),
  aiPortfolio: () => request<{ analysis: PortfolioAnalysis }>('/ai/portfolio'),
  aiRecommendations: () =>
    request<{ recommendations: { symbol: string; signal: string; score: number; summary: string }[] }>(
      '/ai/recommendations',
    ),

  // notifications + alerts
  notifications: () => request<{ notifications: Notification[]; unread: number }>('/notifications'),
  markAllRead: () => request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  alerts: () => request<{ alerts: PriceAlert[] }>('/notifications/alerts'),
  createAlert: (input: { symbol: string; direction: string; targetPrice: number }) =>
    request<{ alert: PriceAlert }>('/notifications/alerts', { method: 'POST', body: JSON.stringify(input) }),
  deleteAlert: (id: string) => request<{ ok: boolean }>(`/notifications/alerts/${id}`, { method: 'DELETE' }),

  // exchanges
  exchanges: () => request<{ accounts: ExchangeAccount[] }>('/exchanges'),
  connectExchange: (input: { exchange: string; label?: string; apiKey: string; apiSecret: string }) =>
    request<{ account: ExchangeAccount }>('/exchanges', { method: 'POST', body: JSON.stringify(input) }),
  deleteExchange: (id: string) => request<{ ok: boolean }>(`/exchanges/${id}`, { method: 'DELETE' }),

  // admin
  adminUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
  adminStats: () => request<AdminStats>('/admin/stats'),
  adminTransactions: () => request<{ transactions: (Tx & { email: string; name: string })[] }>('/admin/transactions'),
  adminSystem: () => request<AdminSystem>('/admin/system'),
}
