import { useState, useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { AuthProvider, useAuth } from './store'
import AuthPage from './app/AuthPage'
import AppArea from './app/AppArea'

// ── DATA ─────────────────────────────────────────────────────────────────────

const CRYPTOS = [
  { symbol: 'BTC',  name: 'Bitcoin',    price: 67_842.50, change: 2.34,  cap: '1.33T',  color: '#F59E0B' },
  { symbol: 'ETH',  name: 'Ethereum',   price: 3_612.80,  change: 1.87,  cap: '434B',   color: '#8B5CF6' },
  { symbol: 'XRP',  name: 'Ripple',     price: 0.6284,    change: -0.94, cap: '35B',    color: '#0EA5E9' },
  { symbol: 'SOL',  name: 'Solana',     price: 178.40,    change: 4.21,  cap: '81B',    color: '#10B981' },
  { symbol: 'AVAX', name: 'Avalanche',  price: 38.72,     change: 3.15,  cap: '16B',    color: '#EF4444' },
  { symbol: 'XLM',  name: 'Stellar',    price: 0.1284,    change: -1.23, cap: '3.7B',   color: '#06B6D4' },
  { symbol: 'ADA',  name: 'Cardano',    price: 0.4872,    change: 0.62,  cap: '17B',    color: '#3B82F6' },
  { symbol: 'DOGE', name: 'Dogecoin',   price: 0.1723,    change: -2.14, cap: '25B',    color: '#FBBF24' },
]

const MARKET_CRYPTOS = [
  ...CRYPTOS,
  { symbol: 'LINK', name: 'Chainlink',  price: 18.34, change: 2.88,  cap: '11B',    color: '#2563EB' },
  { symbol: 'MATIC',name: 'Polygon',    price: 0.862, change: -0.44, cap: '8B',     color: '#7C3AED' },
]

const FEATURES = [
  { icon: '🧠', title: 'AI Market Analysis',        desc: 'Deep neural networks scan 500+ market signals every second to detect emerging trends before they move the price.' },
  { icon: '⚡', title: 'Automated Trading Strategies', desc: 'Set your risk profile once — AI handles entry, exit, and position sizing with institutional precision.' },
  { icon: '🛡️', title: 'Risk Management',           desc: 'Dynamic stop-loss, drawdown limits, and volatility-adjusted position sizes protect your capital automatically.' },
  { icon: '🎯', title: 'Portfolio Optimization',    desc: 'Modern portfolio theory powered by real-time correlation matrices rebalances your holdings daily.' },
  { icon: '🔮', title: 'Machine Learning Predictions', desc: 'Trained on 8 years of crypto market data, our models achieve 73% directional accuracy on major pairs.' },
  { icon: '👁️', title: '24/7 Market Monitoring',   desc: 'Never miss a move. Our infrastructure monitors every exchange tick, 365 days a year, without fatigue.' },
  { icon: '📡', title: 'Real-Time Trading Signals', desc: 'Actionable buy/sell signals pushed to your dashboard and mobile in under 80ms latency.' },
  { icon: '🔔', title: 'Smart Notifications',       desc: 'AI-curated alerts filter out noise and surface only the signals that matter for your portfolio.' },
  { icon: '📊', title: 'Dynamic Asset Allocation',  desc: 'Market regime detection shifts your allocation between growth, defensive, and neutral postures automatically.' },
  { icon: '⚖️', title: 'Intelligent Rebalancing',  desc: 'Tax-aware rebalancing executes drift corrections at optimal moments with minimal market impact.' },
]

const STEPS = [
  { n: '01', title: 'Create your account',         desc: 'Sign up in under 2 minutes with your email. No credit card required.' },
  { n: '02', title: 'Verify your identity',        desc: 'Complete KYC verification — secure, encrypted, and processed in minutes.' },
  { n: '03', title: 'Deposit cryptocurrency',      desc: 'Transfer crypto from any wallet or exchange directly to your account.' },
  { n: '04', title: 'Choose an AI strategy',       desc: 'Select Conservative, Balanced, or Growth — or let AI choose based on your goals.' },
  { n: '05', title: 'AI begins monitoring markets', desc: 'Your AI engine activates and starts analyzing market conditions immediately.' },
  { n: '06', title: 'Monitor your portfolio',      desc: 'Watch your portfolio grow through the real-time dashboard and performance analytics.' },
  { n: '07', title: 'Withdraw profits anytime',    desc: 'No lock-ups. Withdraw to any wallet or exchange within 24 hours.' },
]

const STATS = [
  { value: 250_000, suffix: '+', label: 'Active Users',          icon: '👥' },
  { value: 3.2,     suffix: 'B', label: 'Trading Volume (USD)',  icon: '💰', prefix: '$' },
  { value: 99.97,   suffix: '%', label: 'Platform Uptime',       icon: '⚡', decimal: 2 },
  { value: 150,     suffix: '+', label: 'Countries Supported',   icon: '🌍' },
  { value: 45,      suffix: 'M+',label: 'AI Decisions Daily',    icon: '🧠' },
  { value: 24,      suffix: '/7', label: 'Continuous Monitoring', icon: '👁️' },
]

const TESTIMONIALS = [
  { name: 'Marcus Thompson',  country: 'United States', role: 'Software Engineer',   img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format', review: "I've tried a dozen platforms. NeuralVault is the only one where I actually feel like a professional investor. The AI genuinely outperforms everything I tried manually." },
  { name: 'Priya Sharma',     country: 'India',         role: 'Financial Analyst',   img: 'https://images.unsplash.com/photo-1494790108755-2616b612b73c?w=80&h=80&fit=crop&auto=format', review: "The risk management alone is worth the subscription. It automatically reduced my exposure before the last major correction. I barely felt the drawdown." },
  { name: 'Lucas Hoffmann',   country: 'Germany',       role: 'Entrepreneur',        img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format', review: "Clean, fast, and genuinely intelligent. The dashboard gives me everything I need at a glance. My portfolio is up 38% since I joined six months ago." },
  { name: 'Aiko Tanaka',      country: 'Japan',         role: 'Portfolio Manager',   img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&auto=format', review: "As a professional, I was skeptical. The AI's portfolio optimization methodology is genuinely sophisticated. I use it alongside my institutional work now." },
  { name: 'Sarah Mitchell',   country: 'Australia',     role: 'Complete Beginner',   img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format', review: "I knew nothing about crypto six months ago. NeuralVault made it completely accessible. The AI handles everything — I just watch my balance grow." },
]

const FAQS = [
  { q: 'How does the AI work?', a: 'Our AI system combines deep learning, reinforcement learning, and natural language processing to analyze price patterns, on-chain data, news sentiment, and macroeconomic factors. It makes trading decisions based on probability-weighted models trained on years of market data.' },
  { q: 'Is my crypto safe?', a: 'Your assets are protected by 256-bit AES encryption, multi-signature cold wallet storage, and are never held in hot wallets beyond operational minimums. We maintain 1:1 proof of reserves and undergo quarterly independent audits.' },
  { q: 'Can I withdraw anytime?', a: 'Yes. There are no lock-up periods or withdrawal gates. You can initiate a withdrawal at any time from the dashboard and receive your funds within 24 hours to any wallet or exchange address.' },
  { q: 'What cryptocurrencies are supported?', a: 'We currently support 150+ digital assets including BTC, ETH, XRP, SOL, AVAX, XLM, ADA, DOGE, LINK, MATIC, and more. New assets are added regularly based on liquidity and community demand.' },
  { q: 'How much does it cost?', a: 'We offer three plans: Starter (free, 1 AI strategy), Professional ($49/mo, 5 strategies + advanced analytics), and Enterprise ($149/mo, unlimited strategies + dedicated account manager). All plans have a 14-day free trial.' },
  { q: 'Can beginners use this?', a: 'Absolutely. NeuralVault was designed from the ground up for people with zero trading experience. Our AI handles all decisions automatically. You choose a risk level, deposit crypto, and monitor your performance — no trading knowledge required.' },
]

const EXCHANGES = ['Binance','Bybit','Kraken','OKX','Coinbase','KuCoin','Gate.io','Bitget']

const PIE_DATA = [
  { name: 'BTC',  value: 38, color: '#F59E0B' },
  { name: 'ETH',  value: 24, color: '#8B5CF6' },
  { name: 'SOL',  value: 16, color: '#10B981' },
  { name: 'Other',value: 22, color: '#0EA5E9' },
]

const generateSparkline = (base: number, up: boolean) =>
  Array.from({ length: 12 }, (_, i) => ({
    v: base * (1 + (up ? 1 : -1) * Math.sin(i * 0.8) * 0.06 + Math.random() * 0.04 - 0.02),
  }))

const PROFIT_DATA = Array.from({ length: 30 }, (_, i) => ({
  d: `Jul ${i + 1}`,
  value: 12_400 + Math.sin(i * 0.5) * 800 + i * 140 + Math.random() * 300,
}))

const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  delay: Math.random() * 8,
  duration: Math.random() * 8 + 6,
  color: ['rgba(14,165,233,0.6)', 'rgba(139,92,246,0.6)', 'rgba(6,182,212,0.6)'][i % 3],
}))

// ── MINI SPARKLINE ────────────────────────────────────────────────────────────
function Spark({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#g-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── COUNTER ───────────────────────────────────────────────────────────────────
function Counter({ to, decimal = 0, prefix = '', suffix = '' }: {
  to: number; decimal?: number; prefix?: string; suffix?: string
}) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = performance.now()
      const dur = 1800
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setVal(+(ease * to).toFixed(decimal))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to, decimal])
  return <span ref={ref}>{prefix}{decimal > 0 ? val.toFixed(decimal) : val.toLocaleString()}{suffix}</span>
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ active, setActive, onLaunch }: { active: string; setActive: (s: string) => void; onLaunch: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const links = ['Home','AI Trading','Markets','Portfolio','About','FAQ','Contact']
  const scroll = (id: string) => {
    const el = document.getElementById(id.toLowerCase().replace(' ', '-'))
    el?.scrollIntoView({ behavior: 'smooth' })
    setActive(id); setMobileOpen(false)
  }
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      transition: 'all 0.3s',
      background: scrolled ? 'rgba(6,10,20,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => scroll('Home')}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 20px rgba(14,165,233,0.4)',
          }}>⬡</div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 20, color: '#F0F4FF',
            letterSpacing: '-0.02em' }}>NeuralVault</span>
        </div>
        {/* Desktop Links */}
        <div style={{ display: 'flex', gap: 4 }} className="hidden-mobile">
          {links.map(l => (
            <button key={l} onClick={() => scroll(l)}
              style={{
                background: active === l ? 'rgba(14,165,233,0.12)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 8,
                color: active === l ? '#0EA5E9' : '#94A3B8',
                fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                fontFamily: 'Inter',
              }}
              onMouseEnter={e => { if (active !== l) (e.target as HTMLElement).style.color = '#F0F4FF' }}
              onMouseLeave={e => { if (active !== l) (e.target as HTMLElement).style.color = '#94A3B8' }}
            >{l}</button>
          ))}
        </div>
        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DemoEntry onEntered={onLaunch}>Try Demo</DemoEntry>
          <button style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94A3B8', padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.4)';
              (e.currentTarget as HTMLElement).style.color = '#F0F4FF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
          onClick={onLaunch}
          >Login</button>
          <button className="btn-shine" style={{
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            boxShadow: '0 0 20px rgba(14,165,233,0.3)', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
          onClick={onLaunch}
          >Get Started</button>
          {/* Mobile hamburger */}
          <button style={{ background: 'none', border: 'none', color: '#94A3B8',
            cursor: 'pointer', fontSize: 22, display: 'none' }}
            className="show-mobile" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ background: 'rgba(6,10,20,0.98)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px 24px' }}>
          {links.map(l => (
            <button key={l} onClick={() => scroll(l)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'none', border: 'none', color: '#94A3B8',
              padding: '12px 0', fontSize: 15, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>{l}</button>
          ))}
        </div>
      )}
    </nav>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero({ onLaunch }: { onLaunch: () => void }) {
  const cryptoIcons = [
    { sym: '₿', name: 'BTC', color: '#F59E0B', x: 8, y: 15, delay: 0 },
    { sym: 'Ξ', name: 'ETH', color: '#8B5CF6', x: 85, y: 10, delay: 1.2 },
    { sym: '◎', name: 'SOL', color: '#10B981', x: 90, y: 60, delay: 2.4 },
    { sym: '✦', name: 'XRP', color: '#0EA5E9', x: 5, y: 70, delay: 0.8 },
    { sym: '▲', name: 'AVAX', color: '#EF4444', x: 50, y: 88, delay: 1.6 },
    { sym: '★', name: 'XLM', color: '#06B6D4', x: 75, y: 80, delay: 3 },
  ]
  return (
    <section id="home" style={{ minHeight: '100vh', position: 'relative', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      padding: '120px 24px 80px', overflow: 'hidden' }}>
      {/* Floating crypto icons */}
      {cryptoIcons.map(ic => (
        <div key={ic.sym} style={{
          position: 'absolute', left: `${ic.x}%`, top: `${ic.y}%`,
          animation: `float-icon ${6 + ic.delay}s ease-in-out infinite`,
          animationDelay: `${ic.delay}s`, pointerEvents: 'none',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `rgba(${ic.color === '#F59E0B' ? '245,158,11' : ic.color === '#8B5CF6' ? '139,92,246' : ic.color === '#10B981' ? '16,185,129' : ic.color === '#0EA5E9' ? '14,165,233' : ic.color === '#EF4444' ? '239,68,68' : '6,182,212'},0.12)`,
            border: `1px solid ${ic.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: ic.color,
            boxShadow: `0 0 20px ${ic.color}30`,
            backdropFilter: 'blur(8px)',
          }}>{ic.sym}</div>
        </div>
      ))}
      {/* Live ticker bar */}
      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(6,10,20,0.6)', overflow: 'hidden', height: 36,
        display: 'flex', alignItems: 'center',
      }}>
        <div className="ticker-track" style={{ gap: 0 }}>
          {[...CRYPTOS, ...CRYPTOS].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 28px', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'JetBrains Mono',
                fontWeight: 600 }}>{c.symbol}</span>
              <span style={{ color: '#F0F4FF', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                ${c.price.toLocaleString()}</span>
              <span style={{ color: c.change >= 0 ? '#10B981' : '#EF4444', fontSize: 10,
                fontFamily: 'JetBrains Mono' }}>
                {c.change >= 0 ? '▲' : '▼'} {Math.abs(c.change)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Hero content */}
      <div style={{ maxWidth: 900, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="fade-in-up" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981',
            boxShadow: '0 0 8px #10B981', animation: 'pulse-ring 1.5s ease-out infinite',
            display: 'inline-block' }} />
          <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>
            AI Engine Active — 45M+ decisions today
          </span>
        </div>
        <h1 className="fade-in-up delay-1" style={{
          fontFamily: 'Outfit', fontSize: 'clamp(42px, 6vw, 84px)', fontWeight: 800,
          lineHeight: 1.05, letterSpacing: '-0.03em', color: '#F0F4FF', marginBottom: 28,
        }}>
          The Future of{' '}
          <span className="gradient-text">AI Cryptocurrency</span>{' '}
          Investing
        </h1>
        <p className="fade-in-up delay-2" style={{
          fontSize: 'clamp(15px, 1.8vw, 19px)', color: '#94A3B8', lineHeight: 1.7,
          maxWidth: 680, margin: '0 auto 48px',
        }}>
          Advanced artificial intelligence continuously analyzes the crypto market, identifies
          high-probability opportunities, manages risk automatically, and helps investors grow
          their digital assets with intelligent automation.
        </p>
        <div className="fade-in-up delay-3" style={{ display: 'flex', gap: 16,
          justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-shine" style={{
            background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
            border: 'none', color: '#fff', padding: '16px 36px', borderRadius: 12,
            cursor: 'pointer', fontSize: 15, fontWeight: 600,
            boxShadow: '0 0 40px rgba(14,165,233,0.35)', transition: 'all 0.3s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px) scale(1.02)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}
          onClick={onLaunch}
          >Start Investing →</button>
          <DemoEntry onEntered={onLaunch} style={{ padding: '16px 36px', borderRadius: 12, fontSize: 15, fontWeight: 600, background: 'rgba(16,185,129,0.06)' }}>
            ▶ Try Demo — $10,000 mock funds
          </DemoEntry>
        </div>
        {/* Trust indicators */}
        <div className="fade-in-up delay-4" style={{ display: 'flex', gap: 32,
          justifyContent: 'center', marginTop: 64, flexWrap: 'wrap' }}>
          {[['250K+','Active Users'],['$3.2B','Volume Traded'],['99.97%','Uptime'],['150+','Countries']].map(([v,l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700, color: '#0EA5E9' }}>{v}</div>
              <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── TRUST ─────────────────────────────────────────────────────────────────────
function Trust() {
  const badges = [
    { icon: '🔐', label: '256-bit Encryption' },
    { icon: '🧠', label: 'AI Powered' },
    { icon: '🏗️', label: 'Secure Infrastructure' },
    { icon: '🛡️', label: 'Multi-Layer Protection' },
    { icon: '❄️', label: 'Cold Wallet Security' },
  ]
  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(28px, 3.5vw, 44px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            Trusted Technology.{' '}
            <span className="gradient-text">Transparent Investing.</span>
          </h2>
        </div>
        {/* Security badges */}
        <div className="trust-badges" style={{ display: 'flex', gap: 12, justifyContent: 'center',
          marginBottom: 64, flexWrap: 'wrap' }}>
          {badges.map(b => (
            <div key={b.label} className="glass hover-lift" style={{
              borderRadius: 12, padding: '14px 22px', display: 'flex',
              alignItems: 'center', gap: 10, cursor: 'default',
            }}>
              <span style={{ fontSize: 18 }}>{b.icon}</span>
              <span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>{b.label}</span>
            </div>
          ))}
        </div>
        {/* Exchange integrations */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ color: '#475569', fontSize: 12, textTransform: 'uppercase',
            letterSpacing: '0.12em', fontWeight: 600 }}>Supported Exchange Integrations</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {EXCHANGES.map(ex => (
            <div key={ex} className="glass hover-lift" style={{
              borderRadius: 10, padding: '12px 24px', cursor: 'default',
            }}>
              <span style={{ color: '#94A3B8', fontSize: 14, fontWeight: 600,
                fontFamily: 'Outfit' }}>{ex}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── ABOUT ─────────────────────────────────────────────────────────────────────
function About() {
  const steps = [
    { icon: '👤', label: 'Beginner joins' },
    { icon: '🧠', label: 'AI analyzes market' },
    { icon: '⚙️', label: 'AI manages portfolio' },
    { icon: '📈', label: 'User monitors profits' },
  ]
  return (
    <section id="about" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80,
          alignItems: 'center' }} className="hero-grid">
          <div>
            <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
              About the Platform
            </p>
            <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
              fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em', marginBottom: 24 }}>
              Built for <span className="gradient-text">Everyone</span>
            </h2>
            <p style={{ color: '#94A3B8', lineHeight: 1.8, marginBottom: 32, fontSize: 16 }}>
              Whether you're depositing your first $100 or managing a seven-figure portfolio,
              NeuralVault's AI does the heavy lifting. No trading charts to study. No complex
              strategies to learn. The AI handles everything — from spotting opportunities to
              managing risk — while you watch your digital assets grow.
            </p>
            <button className="btn-shine" style={{
              background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
              border: 'none', color: '#fff', padding: '14px 32px', borderRadius: 10,
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
            }} onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>Learn How It Works</button>
          </div>
          {/* Flow diagram */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
            {steps.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div className="glass hover-lift grad-border" style={{
                  borderRadius: 16, padding: '20px 32px', width: '100%',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: `linear-gradient(135deg, rgba(14,165,233,0.2), rgba(139,92,246,0.2))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                    border: '1px solid rgba(14,165,233,0.2)', flexShrink: 0,
                  }}>{s.icon}</div>
                  <span style={{ color: '#F0F4FF', fontWeight: 600, fontSize: 15 }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 2, height: 24,
                    background: 'linear-gradient(180deg, rgba(14,165,233,0.4), rgba(139,92,246,0.4))' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FEATURES ──────────────────────────────────────────────────────────────────
function Features() {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <section id="ai-trading" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            Why Our AI
          </p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            Intelligence built for every{' '}
            <span className="gradient-text">market condition</span>
          </h2>
        </div>
        <div className="features-grid" style={{ display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i}
              className="glass hover-lift"
              style={{
                borderRadius: 16, padding: '28px 22px', cursor: 'default',
                border: hovered === i ? '1px solid rgba(14,165,233,0.3)' : '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.3s',
                background: hovered === i ? 'rgba(14,165,233,0.06)' : 'rgba(255,255,255,0.03)',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 16,
                background: 'rgba(14,165,233,0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 22,
                border: '1px solid rgba(14,165,233,0.15)',
                transition: 'all 0.3s',
                boxShadow: hovered === i ? '0 0 20px rgba(14,165,233,0.2)' : 'none',
              }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'Outfit', fontSize: 15, fontWeight: 600,
                color: '#F0F4FF', marginBottom: 10, lineHeight: 1.3 }}>{f.title}</h3>
              <p style={{ color: '#64748B', fontSize: 12.5, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── HOW IT WORKS ──────────────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            How It Works
          </p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            From zero to <span className="gradient-text">AI-powered</span> in minutes
          </h2>
        </div>
        <div style={{ position: 'relative' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 35, top: 20, bottom: 20, width: 2,
            background: 'linear-gradient(180deg, #0EA5E9, #8B5CF6, transparent)',
            borderRadius: 2,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map((s, i) => (
              <div key={i} className="hover-lift" style={{
                display: 'flex', gap: 32, alignItems: 'flex-start',
                padding: '20px 20px 20px 80px', borderRadius: 16,
                transition: 'all 0.3s', position: 'relative',
                cursor: 'default',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* Step number */}
                <div style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  width: 46, height: 46, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Outfit', fontSize: 13, fontWeight: 700, color: '#fff',
                  boxShadow: '0 0 20px rgba(14,165,233,0.3)', flexShrink: 0,
                  zIndex: 1,
                }}>{s.n}</div>
                <div>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 17, fontWeight: 600,
                    color: '#F0F4FF', marginBottom: 6 }}>{s.title}</h3>
                  <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── DASHBOARD PREVIEW ─────────────────────────────────────────────────────────
function Dashboard() {
  const positions = [
    { pair: 'BTC/USDT', side: 'LONG', size: '$12,400', pnl: '+$842', pct: '+6.7%', up: true },
    { pair: 'ETH/USDT', side: 'LONG', size: '$8,200',  pnl: '+$316', pct: '+3.8%', up: true },
    { pair: 'SOL/USDT', side: 'SHORT',size: '$3,100',  pnl: '-$84',  pct: '-2.7%', up: false },
  ]
  const trades = [
    { time: '14:32', pair: 'BTC', action: 'BUY',  price: '67,420', status: 'Filled' },
    { time: '13:58', pair: 'ETH', action: 'BUY',  price: '3,594',  status: 'Filled' },
    { time: '12:41', pair: 'SOL', action: 'SELL', price: '178.40', status: 'Filled' },
    { time: '11:29', pair: 'ADA', action: 'BUY',  price: '0.4860', status: 'Filled' },
  ]
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            Live Dashboard Preview
          </p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            Command your portfolio with <span className="gradient-text">clarity</span>
          </h2>
        </div>
        {/* Dashboard mockup */}
        <div className="grad-border" style={{ borderRadius: 24, overflow: 'hidden' }}>
          <div style={{ background: '#080D1A', borderRadius: 24, overflow: 'hidden' }}>
            {/* Top bar */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 7 }}>
                {['#EF4444','#FBBF24','#10B981'].map(c => (
                  <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c, opacity: 0.7 }} />
                ))}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8,
                  padding: '5px 16px', fontSize: 11, color: '#475569', fontFamily: 'JetBrains Mono' }}>
                  app.neuralvault.ai/dashboard
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981',
                  boxShadow: '0 0 8px #10B981' }} />
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>AI Active</span>
              </div>
            </div>
            <div style={{ padding: 24, display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr) 1.5fr', gap: 16 }} className="hero-grid">
              {/* Metric cards */}
              {[
                { label: 'Portfolio Balance', val: '$47,284.60', sub: '↑ +$1,842 today', up: true },
                { label: "Today's Profit",    val: '+$1,842.30', sub: '+4.05%', up: true },
                { label: 'Weekly Performance',val: '+$4,219.80', sub: '+9.76%', up: true },
                { label: 'Monthly Performance',val: '+$11,400', sub: '+31.7%', up: true },
              ].map(m => (
                <div key={m.label} className="glass" style={{ borderRadius: 14, padding: '18px 16px' }}>
                  <p style={{ color: '#475569', fontSize: 11, fontWeight: 500, marginBottom: 8 }}>{m.label}</p>
                  <p style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700,
                    color: m.up ? '#10B981' : '#EF4444', lineHeight: 1 }}>{m.val}</p>
                  <p style={{ color: m.up ? '#10B981' : '#EF4444', fontSize: 11, marginTop: 6 }}>{m.sub}</p>
                </div>
              ))}
              {/* AI Confidence */}
              <div className="glass" style={{ borderRadius: 14, padding: '18px 16px', gridRow: '1 / 3' }}>
                <p style={{ color: '#475569', fontSize: 11, fontWeight: 500, marginBottom: 12 }}>AI Confidence</p>
                <div style={{ position: 'relative', height: 120, display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <PieChart width={120} height={120}>
                    <Pie data={[{ value: 84 }, { value: 16 }]} cx={55} cy={55} innerRadius={42} outerRadius={55}
                      startAngle={90} endAngle={-270} dataKey="value">
                      <Cell fill="#0EA5E9" />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Outfit', fontSize: 26, fontWeight: 700, color: '#0EA5E9', lineHeight: 1 }}>84%</p>
                    <p style={{ color: '#475569', fontSize: 10 }}>confidence</p>
                  </div>
                </div>
                <p style={{ color: '#10B981', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  Bullish signals dominant
                </p>
              </div>
              {/* Profit graph */}
              <div className="glass" style={{ borderRadius: 14, padding: '18px 16px',
                gridColumn: '1 / 5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 12 }}>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600 }}>Portfolio Growth</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['1W','1M','3M','1Y'].map((t, i) => (
                      <button key={t} style={{
                        background: i === 1 ? 'rgba(14,165,233,0.15)' : 'transparent',
                        border: i === 1 ? '1px solid rgba(14,165,233,0.3)' : '1px solid transparent',
                        color: i === 1 ? '#0EA5E9' : '#475569',
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={PROFIT_DATA}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tick={{ fill: '#475569', fontSize: 9 }}
                      tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false}
                      axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: '#0C1222', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#94A3B8' }}
                      formatter={(v) => [`$${Number(v).toFixed(0)}`, 'Balance']} />
                    <Area type="monotone" dataKey="value" stroke="#0EA5E9"
                      strokeWidth={2} fill="url(#profitGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Bottom section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
              padding: '0 24px 24px' }}>
              {/* Allocation pie */}
              <div className="glass" style={{ borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                  Asset Allocation
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <PieChart width={90} height={90}>
                    <Pie data={PIE_DATA} cx={40} cy={40} innerRadius={28} outerRadius={42} dataKey="value">
                      {PIE_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PIE_DATA.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ color: '#94A3B8', fontSize: 11 }}>{d.name}</span>
                        <span style={{ color: '#F0F4FF', fontSize: 11, fontWeight: 600,
                          marginLeft: 'auto', fontFamily: 'JetBrains Mono' }}>{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Open positions */}
              <div className="glass" style={{ borderRadius: 14, padding: '18px 16px' }}>
                <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Open Positions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {positions.map(p => (
                    <div key={p.pair} style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div>
                        <p style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 600 }}>{p.pair}</p>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: p.side === 'LONG' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: p.side === 'LONG' ? '#10B981' : '#EF4444', fontWeight: 600 }}>{p.side}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: p.up ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: 700 }}>{p.pnl}</p>
                        <p style={{ color: '#475569', fontSize: 10 }}>{p.pct}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Recent trades + quick actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="glass" style={{ borderRadius: 14, padding: '18px 16px', flex: 1 }}>
                  <p style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recent Trades</p>
                  {trades.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '6px 0',
                      borderBottom: i < trades.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}>{t.time}</span>
                        <span style={{ color: '#F0F4FF', fontSize: 11, fontWeight: 600 }}>{t.pair}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: t.action === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: t.action === 'BUY' ? '#10B981' : '#EF4444' }}>{t.action}</span>
                      </div>
                      <span style={{ color: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono' }}>${t.price}</span>
                    </div>
                  ))}
                </div>
                {/* Quick actions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[['Buy','#10B981'],['Sell','#EF4444'],['Deposit','#0EA5E9'],['Withdraw','#8B5CF6'],['Report','#F59E0B'],['Settings','#94A3B8']].map(([label, color]) => (
                    <button key={label} style={{
                      background: `rgba(${color === '#10B981' ? '16,185,129' : color === '#EF4444' ? '239,68,68' : color === '#0EA5E9' ? '14,165,233' : color === '#8B5CF6' ? '139,92,246' : color === '#F59E0B' ? '245,158,11' : '148,163,184'},0.1)`,
                      border: `1px solid ${color}25`,
                      color, borderRadius: 8, padding: '8px 4px',
                      cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.2s',
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── MARKETS ───────────────────────────────────────────────────────────────────
function Markets() {
  return (
    <section id="markets" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Markets</p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            Track every <span className="gradient-text">digital asset</span>
          </h2>
        </div>
        <div className="markets-grid" style={{ display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {MARKET_CRYPTOS.map(c => {
            const spark = generateSparkline(c.price, c.change >= 0)
            return (
              <div key={c.symbol} className="glass hover-lift" style={{ borderRadius: 16, padding: '20px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 8,
                      background: `${c.color}20`, border: `1px solid ${c.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: c.color,
                    }}>{c.symbol.slice(0,3)}</div>
                    <p style={{ color: '#F0F4FF', fontWeight: 600, fontSize: 13 }}>{c.name}</p>
                  </div>
                  <span style={{
                    background: c.change >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    color: c.change >= 0 ? '#10B981' : '#EF4444',
                    padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    fontFamily: 'JetBrains Mono',
                  }}>{c.change >= 0 ? '+' : ''}{c.change}%</span>
                </div>
                <p style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700,
                  color: '#F0F4FF', marginBottom: 4 }}>
                  ${c.price < 1 ? c.price.toFixed(4) : c.price.toLocaleString()}
                </p>
                <p style={{ color: '#475569', fontSize: 11, marginBottom: 10 }}>
                  MCap: ${c.cap}
                </p>
                <Spark data={spark} color={c.change >= 0 ? '#10B981' : '#EF4444'} />
                <button style={{
                  marginTop: 12, width: '100%',
                  background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.15))',
                  border: '1px solid rgba(14,165,233,0.2)',
                  color: '#0EA5E9', borderRadius: 8, padding: '9px', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(14,165,233,0.25), rgba(139,92,246,0.25))' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.15))' }}
                >Buy {c.symbol}</button>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>AI Performance</p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(32px, 3.5vw, 48px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            The numbers that <span className="gradient-text">speak for themselves</span>
          </h2>
        </div>
        <div className="stats-grid" style={{ display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {STATS.map((s, i) => (
            <div key={i} className="grad-border hover-lift" style={{ cursor: 'default' }}>
              <div className="glass" style={{ borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{s.icon}</div>
                <div style={{ fontFamily: 'Outfit', fontSize: 'clamp(36px, 4vw, 52px)',
                  fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}
                  className="gradient-text">
                  <Counter to={s.value} decimal={s.decimal || 0} prefix={s.prefix || ''} suffix={s.suffix} />
                </div>
                <p style={{ color: '#64748B', fontSize: 14, marginTop: 12 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── TESTIMONIALS ──────────────────────────────────────────────────────────────
function Testimonials() {
  const [active, setActive] = useState(0)
  const prev = () => setActive(a => (a - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  const next = useCallback(() => setActive(a => (a + 1) % TESTIMONIALS.length), [])
  useEffect(() => { const id = setInterval(next, 4500); return () => clearInterval(id) }, [next])
  const t = TESTIMONIALS[active]
  return (
    <section style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Testimonials</p>
        <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(28px, 3vw, 42px)',
          fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em', marginBottom: 48 }}>
          Trusted by investors <span className="gradient-text">worldwide</span>
        </h2>
        <div className="grad-border" style={{ marginBottom: 40 }}>
          <div className="glass" style={{ borderRadius: 24, padding: '48px 48px' }}>
            <div style={{ color: '#F59E0B', fontSize: 20, marginBottom: 24, letterSpacing: 4 }}>★★★★★</div>
            <p style={{ color: '#94A3B8', fontSize: 17, lineHeight: 1.8, marginBottom: 32,
              fontStyle: 'italic' }}>"{t.review}"</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
              <img src={t.img} alt={t.name} style={{ width: 52, height: 52, borderRadius: '50%',
                border: '2px solid rgba(14,165,233,0.3)' }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#F0F4FF', fontWeight: 600, fontSize: 15 }}>{t.name}</p>
                <p style={{ color: '#475569', fontSize: 12 }}>{t.role} · {t.country}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={prev} style={{ width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94A3B8', cursor: 'pointer', fontSize: 16 }}>←</button>
          {TESTIMONIALS.map((_, i) => (
            <div key={i} onClick={() => setActive(i)} style={{
              width: i === active ? 24 : 8, height: 8, borderRadius: 4,
              background: i === active ? '#0EA5E9' : 'rgba(255,255,255,0.15)',
              cursor: 'pointer', transition: 'all 0.3s',
            }} />
          ))}
          <button onClick={next} style={{ width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94A3B8', cursor: 'pointer', fontSize: 16 }}>→</button>
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" style={{ padding: '100px 24px', background: 'rgba(255,255,255,0.01)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>FAQ</p>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(28px, 3.5vw, 44px)',
            fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em' }}>
            Frequently asked <span className="gradient-text">questions</span>
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((f, i) => (
            <div key={i} className="glass" style={{
              borderRadius: 14,
              border: open === i ? '1px solid rgba(14,165,233,0.25)' : '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden', transition: 'border-color 0.3s',
            }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '20px 24px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', textAlign: 'left',
              }}>
                <span style={{ color: '#F0F4FF', fontWeight: 600, fontSize: 15 }}>{f.q}</span>
                <span style={{
                  color: open === i ? '#0EA5E9' : '#475569', fontSize: 18,
                  transform: open === i ? 'rotate(45deg)' : 'none', transition: 'all 0.3s',
                  flexShrink: 0, marginLeft: 16,
                }}>+</span>
              </button>
              <div className={`accordion-content ${open === i ? 'open' : ''}`}>
                <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.75,
                  padding: '0 24px 20px' }}>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CONTACT ───────────────────────────────────────────────────────────────────
function Contact() {
  const [sent, setSent] = useState(false)
  return (
    <section id="contact" style={{ padding: '100px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }} className="hero-grid">
          <div>
            <p style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Contact</p>
            <h2 style={{ fontFamily: 'Outfit', fontSize: 'clamp(28px, 3vw, 44px)',
              fontWeight: 700, color: '#F0F4FF', letterSpacing: '-0.02em', marginBottom: 16 }}>
              Get in <span className="gradient-text">touch</span>
            </h2>
            <p style={{ color: '#64748B', fontSize: 15, lineHeight: 1.7, marginBottom: 40 }}>
              Our team of AI and fintech specialists are here to help you start your
              digital asset management journey.
            </p>
            {[
              { icon: '📍', label: 'Address', val: '1 Canada Square, Canary Wharf, London, E14 5AB' },
              { icon: '✉️', label: 'Email', val: 'hello@neuralvault.ai' },
              { icon: '📞', label: 'Phone', val: '+44 20 7946 0123' },
              { icon: '💬', label: 'Live Chat', val: 'Available 24/7 via in-app chat' },
              { icon: '🕐', label: 'Support Hours', val: 'Mon–Fri, 9AM–6PM GMT' },
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{c.icon}</div>
                <div>
                  <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginBottom: 3,
                    textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.label}</p>
                  <p style={{ color: '#94A3B8', fontSize: 14 }}>{c.val}</p>
                </div>
              </div>
            ))}
            {/* Social links */}
            <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
              {['𝕏','in','▶','📘'].map(s => (
                <div key={s} className="glass hover-lift" style={{
                  width: 40, height: 40, borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>{s}</div>
              ))}
            </div>
          </div>
          {/* Contact form */}
          <div className="grad-border">
            <div className="glass" style={{ borderRadius: 20, padding: '40px' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700,
                    color: '#F0F4FF', marginBottom: 12 }}>Message sent!</h3>
                  <p style={{ color: '#64748B' }}>We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ fontFamily: 'Outfit', fontSize: 22, fontWeight: 700,
                    color: '#F0F4FF', marginBottom: 8 }}>Send us a message</h3>
                  <p style={{ color: '#475569', fontSize: 13, marginBottom: 28 }}>
                    We reply within 24 hours on business days.
                  </p>
                  {/* Map placeholder */}
                  <div style={{ borderRadius: 12, height: 120, marginBottom: 24, overflow: 'hidden',
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#475569', fontSize: 13 }}>📍 Canary Wharf, London</span>
                  </div>
                  {[
                    { id: 'name',    label: 'Full Name',     type: 'text',  ph: 'Marcus Thompson' },
                    { id: 'email',   label: 'Email Address', type: 'email', ph: 'marcus@example.com' },
                    { id: 'subject', label: 'Subject',       type: 'text',  ph: 'I want to learn more about...' },
                  ].map(f => (
                    <div key={f.id} style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', color: '#64748B', fontSize: 12,
                        fontWeight: 600, marginBottom: 6, textTransform: 'uppercase',
                        letterSpacing: '0.08em' }}>{f.label}</label>
                      <input type={f.type} placeholder={f.ph} style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                        padding: '12px 16px', color: '#F0F4FF', fontSize: 14,
                        outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter',
                        transition: 'border-color 0.2s',
                      }}
                        onFocus={e => { (e.target as HTMLElement).style.borderColor = 'rgba(14,165,233,0.4)' }}
                        onBlur={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
                      />
                    </div>
                  ))}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', color: '#64748B', fontSize: 12,
                      fontWeight: 600, marginBottom: 6, textTransform: 'uppercase',
                      letterSpacing: '0.08em' }}>Message</label>
                    <textarea placeholder="Tell us about your investment goals..." style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                      padding: '12px 16px', color: '#F0F4FF', fontSize: 14,
                      outline: 'none', resize: 'vertical', minHeight: 100,
                      boxSizing: 'border-box', fontFamily: 'Inter',
                    }}
                      onFocus={e => { (e.target as HTMLElement).style.borderColor = 'rgba(14,165,233,0.4)' }}
                      onBlur={e => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  <button className="btn-shine" onClick={() => setSent(true)} style={{
                    width: '100%', background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                    border: 'none', color: '#fff', padding: '14px', borderRadius: 10,
                    cursor: 'pointer', fontSize: 15, fontWeight: 600,
                    boxShadow: '0 0 30px rgba(14,165,233,0.3)',
                  }}>Send Message →</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { title: 'Company', links: ['About','Careers','Blog','Press Kit','Partner Program'] },
    { title: 'Product',  links: ['AI Trading','Markets','Portfolio','Pricing','API Docs','Changelog'] },
    { title: 'Legal',    links: ['Privacy Policy','Terms of Service','Risk Disclosure','AML Policy','Cookie Policy'] },
    { title: 'Support',  links: ['Help Center','Community','Contact Us','System Status','Security'] },
  ]
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="footer-grid" style={{ display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 48, marginBottom: 56 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: '0 0 20px rgba(14,165,233,0.4)' }}>⬡</div>
              <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 20, color: '#F0F4FF' }}>NeuralVault</span>
            </div>
            <p style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, marginBottom: 24, maxWidth: 260 }}>
              AI-powered digital asset management for everyone. Invest smarter, not harder.
            </p>
            {/* Newsletter */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="your@email.com" style={{
                flex: 1, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                padding: '10px 14px', color: '#F0F4FF', fontSize: 13,
                outline: 'none', fontFamily: 'Inter',
              }} />
              <button style={{
                background: 'linear-gradient(135deg, #0EA5E9, #8B5CF6)',
                border: 'none', color: '#fff', borderRadius: 8, padding: '10px 16px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Subscribe</button>
            </div>
          </div>
          {cols.map(col => (
            <div key={col.title}>
              <p style={{ color: '#F0F4FF', fontWeight: 600, fontSize: 13,
                marginBottom: 16, fontFamily: 'Outfit' }}>{col.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ color: '#475569', fontSize: 13,
                    textDecoration: 'none', transition: 'color 0.2s' }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.color = '#94A3B8' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.color = '#475569' }}
                  >{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ color: '#2D3748', fontSize: 12 }}>
            © 2024 NeuralVault Ltd. All rights reserved. Cryptocurrency investments carry risk.
            Past performance is not indicative of future results.
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Privacy','Terms','Risk Disclosure','Cookies'].map(l => (
              <a key={l} href="#" style={{ color: '#2D3748', fontSize: 11, textDecoration: 'none',
                padding: '4px 8px', borderRadius: 4, transition: 'color 0.2s' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = '#94A3B8' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = '#2D3748' }}
              >{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function AppShell({ onExit }: { onExit: () => void }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <AppArea onExit={onExit} /> : <AuthPage />
}

/** One-click demo/testnet account entry (rendered inside AuthProvider). */
function DemoEntry({
  onEntered,
  style,
  children,
}: {
  onEntered: () => void
  style?: CSSProperties
  children?: ReactNode
}) {
  const { startDemo, loading } = useAuth()
  return (
    <button
      disabled={loading}
      onClick={async () => {
        try {
          await startDemo()
        } catch {
          // fall through — the auth page explains errors if it opens
        }
        onEntered()
      }}
      style={{
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.35)',
        color: '#10B981',
        padding: '8px 16px',
        borderRadius: 8,
        cursor: loading ? 'wait' : 'pointer',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'Inter',
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {loading ? 'Creating demo account…' : (children ?? 'Try Demo')}
    </button>
  )
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeNav, setActiveNav] = useState('Home')
  const [view, setView] = useState<'marketing' | 'app'>('marketing')

  return (
    <AuthProvider>
      <div style={{ position: 'relative', minHeight: '100vh', background: '#060A14' }}>
      {/* Aurora background */}
      <div className="aurora">
        <div className="aurora-blob-1" />
        <div className="aurora-blob-2" />
        <div className="aurora-blob-3" />
      </div>
      {/* Floating particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {PARTICLES.map(p => (
          <div key={p.id} className="particle" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animation: `float-particle ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>
      {/* Grid lines subtle overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(14,165,233,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(14,165,233,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />
      {/* Content */}
      {view === 'app' ? (
        <div style={{ position: 'relative', zIndex: 1 }}>
          <AppShell onExit={() => setView('marketing')} />
        </div>
      ) : (
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Nav active={activeNav} setActive={setActiveNav} onLaunch={() => setView('app')} />
        <Hero onLaunch={() => setView('app')} />
        <Trust />
        <About />
        <Features />
        <HowItWorks />
        <Dashboard />
        <Markets />
        <Stats />
        <Testimonials />
        <FAQ />
        <Contact />
        <Footer />
      </div>
      )}
      </div>
      </AuthProvider>
  )
}
