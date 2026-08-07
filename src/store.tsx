import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, getToken, setToken, type User } from './api'

/** Thrown when login succeeds but a TOTP code is required. */
export class TwoFactorRequiredError extends Error {
  constructor() {
    super('Two-factor code required')
    this.name = 'TwoFactorRequiredError'
  }
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string, totpCode?: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  // Any 401 from the API clears the session.
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('nv-unauthorized', onUnauthorized)
    return () => window.removeEventListener('nv-unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const res = await api.login(email, password, totpCode)
    if (res.requiresTwoFactor) throw new TwoFactorRequiredError()
    if (!res.user || !res.token) throw new Error('Login failed')
    setToken(res.token)
    setUser(res.user)
  }, [])

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      const { user, token } = await api.signup(email, password, name)
      setToken(token)
      setUser(user)
    },
    [],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
