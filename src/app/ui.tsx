import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

export const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

export const fmtNum = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtPrice = (n: number) =>
  n >= 1000
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { maximumFractionDigits: 4 })

export const fmtTime = (iso: string) => new Date(iso).toLocaleString()

export function useFetch<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): { data: T | null; error: string | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fn()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  return { data, error, loading, refresh: () => setVersion((v) => v + 1) }
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="glass" style={{ borderRadius: 16, padding: 20, ...style }}>
      {children}
    </div>
  )
}

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  style?: CSSProperties
}

export function GradientButton({ children, onClick, disabled, style }: ButtonProps) {
  return (
    <button
      className="btn-shine"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
        border: 'none',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick, disabled, style }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#94A3B8',
        padding: '12px 20px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14,
        fontWeight: 600,
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span
        style={{
          display: 'block',
          color: '#64748B',
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '11px 14px',
  color: '#F0F4FF',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Inter',
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#FCA5A5',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  )
}

export function PageTitle({ title, sub }: { title: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2
        style={{
          fontFamily: 'Outfit',
          fontSize: 26,
          fontWeight: 700,
          color: '#F0F4FF',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h2>
      {sub && <p style={{ color: '#64748B', fontSize: 13, marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

export function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 6,
        background: `${color}1f`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
