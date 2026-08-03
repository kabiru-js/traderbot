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

export interface User {
  id: string
  email: string
  name: string
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
  created_at: string
}

export interface Portfolio {
  balance: number
  totalPnl: number
  equity: { t: string; balance: number }[]
  openPositions: (Bot & { price: number | null; unrealized_pnl: number })[]
  trades: Trade[]
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>('/auth/me'),
  wallet: () => request<Wallet>('/wallet'),
  deposit: (amount: number) =>
    request<{ balance?: number; checkoutUrl?: string }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  bots: () => request<{ bots: Bot[] }>('/bots'),
  createBot: (input: { symbol: string; strategy: string; capital: number }) =>
    request<{ bot: Bot }>('/bots', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  startBot: (id: string) => request<{ bot: Bot }>(`/bots/${id}/start`, { method: 'POST' }),
  stopBot: (id: string) => request<{ bot: Bot }>(`/bots/${id}/stop`, { method: 'POST' }),
  portfolio: () => request<Portfolio>('/portfolio'),
}
