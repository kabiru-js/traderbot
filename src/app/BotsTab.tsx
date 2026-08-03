import { useState } from 'react'
import { api, type Bot } from '../api'
import {
  Badge,
  Card,
  ErrorBox,
  Field,
  GhostButton,
  GradientButton,
  PageTitle,
  fmtMoney,
  fmtNum,
  fmtPrice,
  inputStyle,
  useFetch,
} from './ui'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

const STRATEGIES = [
  { id: 'momentum', label: 'Momentum — rides breakouts' },
  { id: 'mean-reversion', label: 'Mean Reversion — fades extremes' },
]

export default function BotsTab({
  tick,
  prices,
}: {
  tick: number
  prices: Record<string, number>
}) {
  const { data, error, loading, refresh } = useFetch<{ bots: Bot[] }>(() => api.bots(), [tick])
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [strategy, setStrategy] = useState('momentum')
  const [capital, setCapital] = useState('1000')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const create = async () => {
    setFormError(null)
    setBusy(true)
    try {
      await api.createBot({ symbol, strategy, capital: Number(capital) })
      refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (bot: Bot) => {
    setFormError(null)
    try {
      if (bot.status === 'running') await api.stopBot(bot.id)
      else await api.startBot(bot.id)
      refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Request failed')
    }
  }

  const bots = data?.bots ?? []

  return (
    <div>
      <PageTitle
        title={
          <>
            Trading <span className="gradient-text">Bots</span>
          </>
        }
        sub="Paper-trading engines that react to live Binance market data."
      />
      {error && <ErrorBox message={error} />}
      {formError && <ErrorBox message={formError} />}

      <Card style={{ marginBottom: 20 }}>
        <p style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          Launch a new bot
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: 14,
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
          <Field label="Strategy">
            <select
              style={inputStyle}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capital (USD)">
            <input
              style={inputStyle}
              type="number"
              min={100}
              max={100000}
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </Field>
          <GradientButton onClick={create} disabled={busy} style={{ height: 42 }}>
            {busy ? 'Creating…' : 'Launch Bot'}
          </GradientButton>
        </div>
      </Card>

      {loading && bots.length === 0 ? (
        <p style={{ color: '#64748B' }}>Loading bots…</p>
      ) : bots.length === 0 ? (
        <Card>
          <p style={{ color: '#64748B', fontSize: 13 }}>
            No bots yet — launch your first paper-trading bot above.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {bots.map((bot) => {
            const livePrice = prices[bot.symbol] ?? bot.price
            const unrealized =
              bot.position_side && bot.position_size && livePrice
                ? bot.position_side === 'LONG'
                  ? (livePrice - (bot.entry_price ?? 0)) * bot.position_size
                  : ((bot.entry_price ?? 0) - livePrice) * bot.position_size
                : bot.unrealized_pnl
            const total = bot.pnl_usd + unrealized
            return (
              <Card key={bot.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <p style={{ fontFamily: 'Outfit', fontSize: 17, fontWeight: 700, color: '#F0F4FF' }}>
                      {bot.symbol.replace('USDT', '/USDT')}
                    </p>
                    <p style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{bot.strategy}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge color={bot.status === 'running' ? '#10B981' : '#64748B'}>
                      {bot.status.toUpperCase()}
                    </Badge>
                    {bot.simulated && <Badge color="#F59E0B">SIMULATED</Badge>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ color: '#475569', marginBottom: 2 }}>Capital</p>
                    <p style={{ color: '#F0F4FF', fontWeight: 600 }}>{fmtMoney(bot.capital)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#475569', marginBottom: 2 }}>Live price</p>
                    <p style={{ color: '#F0F4FF', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                      {livePrice ? fmtPrice(livePrice) : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#475569', marginBottom: 2 }}>Realized PnL</p>
                    <p style={{ color: bot.pnl_usd >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      {fmtMoney(bot.pnl_usd)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#475569', marginBottom: 2 }}>Total PnL</p>
                    <p style={{ color: total >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      {fmtMoney(total)}
                    </p>
                  </div>
                </div>

                {bot.position_side && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginBottom: 14,
                      fontSize: 12,
                    }}
                  >
                    <p style={{ color: '#64748B', marginBottom: 4 }}>
                      Position:{' '}
                      <span
                        style={{
                          color: bot.position_side === 'LONG' ? '#10B981' : '#EF4444',
                          fontWeight: 700,
                        }}
                      >
                        {bot.position_side}
                      </span>{' '}
                      · {fmtNum(bot.position_size ?? 0, 4)} units · entry{' '}
                      {fmtPrice(bot.entry_price ?? 0)}
                    </p>
                    <p style={{ color: unrealized >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                      Unrealized: {fmtMoney(unrealized)}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  {bot.status === 'running' ? (
                    <GhostButton
                      onClick={() => toggle(bot)}
                      style={{ flex: 1, borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444' }}
                    >
                      Stop Bot
                    </GhostButton>
                  ) : (
                    <GradientButton onClick={() => toggle(bot)} style={{ flex: 1 }}>
                      Start Bot
                    </GradientButton>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
