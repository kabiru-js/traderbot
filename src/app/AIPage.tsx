import { Sparkles } from 'lucide-react'
import { api, type MarketAnalysis } from '../api'
import { Badge, Card, ErrorBox, PageTitle, useFetch } from './ui'

export default function AIPage({ tick }: { tick: number }) {
  const risk = useFetch<{ analysis: { riskScore: number; summary: string; recommendations: string[] } }>(
    () => api.aiPortfolio(),
    [tick],
  )
  const btc = useFetch<{ analysis: MarketAnalysis }>(() => api.aiAnalysis('BTCUSDT'), [tick])
  const eth = useFetch<{ analysis: MarketAnalysis }>(() => api.aiAnalysis('ETHUSDT'), [tick])
  const sol = useFetch<{ analysis: MarketAnalysis }>(() => api.aiAnalysis('SOLUSDT'), [tick])
  const bnb = useFetch<{ analysis: MarketAnalysis }>(() => api.aiAnalysis('BNBUSDT'), [tick])
  const xrp = useFetch<{ analysis: MarketAnalysis }>(() => api.aiAnalysis('XRPUSDT'), [tick])
  const recs = useFetch<{ recommendations: { symbol: string; signal: string; score: number; summary: string }[] }>(
    () => api.aiRecommendations(),
    [tick],
  )

  const riskScore = risk.data?.analysis?.riskScore ?? 0
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MODERATE' : 'LOW'
  const riskTone = riskScore >= 70 ? '#EF4444' : riskScore >= 40 ? '#F59E0B' : '#10B981'

  return (
    <div>
      <PageTitle
        title={
          <>
            <span className="gradient-text">AI</span> Intelligence
          </>
        }
        sub="Market regime, portfolio risk, and asset signals — your analyst, not a chatbot."
      />
      {risk.error && <ErrorBox message={risk.error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="hero-grid">
        {/* Portfolio risk */}
        <Card style={{ border: '1px solid rgba(139,92,246,0.18)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            <Sparkles size={14} /> Portfolio Risk
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: 'Outfit', fontSize: 34, fontWeight: 800, color: '#F0F4FF' }}>{riskScore}</span>
            <span style={{ color: '#64748B', fontSize: 13 }}>/ 100</span>
            <Badge color={riskTone}>{riskLevel}</Badge>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            {risk.data?.analysis?.summary ?? 'Analyzing…'}
          </p>
          {(risk.data?.analysis?.recommendations ?? []).map((rec, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 8,
                fontSize: 13,
                color: '#94A3B8',
              }}
            >
              {rec}
            </div>
          ))}
        </Card>

        {/* Recommendations */}
        <Card>
          <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Recommendations</p>
          {(recs.data?.recommendations ?? []).length === 0 ? (
            <p style={{ color: '#64748B', fontSize: 13 }}>No actionable signals right now.</p>
          ) : (
            (recs.data?.recommendations ?? []).map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 13, fontFamily: 'JetBrains Mono' }}>
                    {r.symbol.replace('USDT', '')}
                  </span>
                  <Badge color={r.signal === 'bullish' ? '#10B981' : '#EF4444'}>{r.signal.toUpperCase()}</Badge>
                  <span style={{ color: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}>score {r.score}</span>
                </div>
                <p style={{ color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{r.summary}</p>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Asset signals */}
      <Card style={{ marginTop: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Asset Signals</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="hero-grid">
          {[
            { symbol: 'BTCUSDT', hook: btc },
            { symbol: 'ETHUSDT', hook: eth },
            { symbol: 'SOLUSDT', hook: sol },
            { symbol: 'BNBUSDT', hook: bnb },
            { symbol: 'XRPUSDT', hook: xrp },
          ].map(({ symbol, hook }) => {
            const a = hook.data?.analysis
            const signalTone = a?.signal === 'bullish' ? '#10B981' : a?.signal === 'bearish' ? '#EF4444' : '#94A3B8'
            return (
              <div
                key={symbol}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ color: '#F0F4FF', fontWeight: 700, fontSize: 14, fontFamily: 'JetBrains Mono' }}>
                    {symbol.replace('USDT', '')}
                  </span>
                  <Badge color={signalTone}>{(a?.signal ?? '—').toUpperCase()}</Badge>
                  {a && (
                    <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                      conf {a.score}/100
                    </span>
                  )}
                </div>
                <p style={{ color: '#64748B', fontSize: 12, lineHeight: 1.5 }}>
                  {a?.summary ?? 'Gathering data…'}
                </p>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
