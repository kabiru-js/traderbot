// End-to-end smoke test against a running API.
//   Local:    node scripts/run-smoke.mjs   (spawns server with embedded/env DB)
//   Remote:   BASE_URL=https://your-app.onrender.com node scripts/smoke.mjs
import crypto from 'node:crypto'

const base = process.env.BASE_URL || 'http://localhost:8787'
let failures = 0

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function check(label, ok, extra = '') {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures++
    console.log(`  FAIL  ${label} ${extra}`)
  }
}

// ── RFC 6238 TOTP (for the 2FA flow) ──────────────────────────────
function base32Decode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out = []
  for (const c of str.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | chars.indexOf(c)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}
function totp(secret, stepSeconds = 30, digits = 6) {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / stepSeconds)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return String(code).padStart(digits, '0')
}
const tokenFromLink = (link) => new URL(link).searchParams.get('token') ?? ''

const email = `smoke-${Date.now()}@example.com`
const resetEmail = `reset-${Date.now()}@example.com`

console.log('1. Health')
let r = await req('/api/health')
check('GET /api/health', r.status === 200 && r.data.status === 'ok')

console.log('2. Auth')
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email, password: 'password123', name: 'Smoke Tester' },
})
check('POST /api/auth/signup', r.status === 201 && !!r.data.token, JSON.stringify(r.data))
const token = r.data.token
const verifyLink = r.data.emailVerification?.devLink ?? ''
check('signup returns email verification link (demo)', verifyLink.length > 0)

r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email, password: 'password123', name: 'Smoke Tester' },
})
check('signup duplicate rejected', r.status === 409)

r = await req('/api/auth/login', {
  method: 'POST',
  body: { email, password: 'password123' },
})
check('POST /api/auth/login', r.status === 200 && !!r.data.token)

r = await req('/api/auth/login', {
  method: 'POST',
  body: { email, password: 'wrong-password' },
})
check('login wrong password rejected', r.status === 401)

r = await req('/api/auth/me', { token })
check('GET /api/auth/me', r.status === 200 && r.data.user.email === email)

console.log('2b. Username login')
const uname = `smokebot${Date.now()}`
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email: `uname-${Date.now()}@example.com`, password: 'password123', name: 'Username User', username: uname },
})
check('signup with username', r.status === 201 && !!r.data.token, JSON.stringify(r.data))
r = await req('/api/auth/login', { method: 'POST', body: { username: uname, password: 'password123' } })
check('login with username', r.status === 200 && !!r.data.token)
r = await req('/api/auth/login', { method: 'POST', body: { username: uname, password: 'wrong-password' } })
check('username login wrong password rejected', r.status === 401)
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email: `dup-${Date.now()}@example.com`, password: 'password123', name: 'Dup', username: uname },
})
check('duplicate username rejected', r.status === 409)

console.log('3. Email verification')
r = await req('/api/auth/verify-email', { method: 'POST', body: { token: tokenFromLink(verifyLink) } })
check('POST /api/auth/verify-email', r.status === 200 && r.data.ok === true)
r = await req('/api/profile', { token })
check('profile shows emailVerified', r.data.profile?.emailVerified === true)
r = await req('/api/auth/resend-verification', { method: 'POST', token })
check('resend verification (already verified)', r.status === 200 && r.data.alreadyVerified === true)

console.log('4. Password reset')
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email: resetEmail, password: 'password123', name: 'Reset User' },
})
const resetToken = r.data.token
r = await req('/api/auth/forgot-password', { method: 'POST', body: { email: resetEmail } })
check('forgot-password returns devLink (demo)', r.status === 200 && !!r.data.devLink)
r = await req('/api/auth/reset-password', {
  method: 'POST',
  body: { token: tokenFromLink(r.data.devLink ?? ''), password: 'newpassword456' },
})
check('reset-password succeeds', r.status === 200 && r.data.ok === true)
r = await req('/api/auth/login', { method: 'POST', body: { email: resetEmail, password: 'newpassword456' } })
check('login with new password', r.status === 200 && !!r.data.token)
r = await req('/api/auth/login', { method: 'POST', body: { email: resetEmail, password: 'password123' } })
check('old password rejected', r.status === 401)
void resetToken

console.log('5. Two-factor authentication')
r = await req('/api/auth/2fa/setup', { method: 'POST', token })
check('2fa setup returns secret', r.status === 200 && !!r.data.secret, JSON.stringify(r.data))
const twoFaSecret = r.data.secret ?? ''
r = await req('/api/auth/2fa/enable', { method: 'POST', token, body: { code: totp(twoFaSecret) } })
check('2fa enable with valid code', r.status === 200 && r.data.twoFactorEnabled === true)
r = await req('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } })
check('login now demands 2FA code', r.status === 200 && r.data.requiresTwoFactor === true)
r = await req('/api/auth/login', { method: 'POST', body: { email, password: 'password123', totpCode: totp(twoFaSecret) } })
check('login with TOTP code', r.status === 200 && !!r.data.token)
r = await req('/api/auth/login', { method: 'POST', body: { email, password: 'password123', totpCode: '000000' } })
check('wrong TOTP code rejected', r.status === 200 && r.data.requiresTwoFactor === true)
r = await req('/api/auth/2fa/disable', { method: 'POST', token, body: { code: totp(twoFaSecret) } })
check('2fa disable', r.status === 200 && r.data.twoFactorEnabled === false)

console.log('6. Profile')
const newUname = `renamed${Date.now()}`
r = await req('/api/profile', { method: 'PATCH', token, body: { name: 'Renamed Tester', username: newUname } })
check('PATCH /api/profile (name + username)', r.status === 200 && r.data.profile?.name === 'Renamed Tester' && r.data.profile?.username === newUname, JSON.stringify(r.data))
r = await req('/api/auth/login', { method: 'POST', body: { username: newUname, password: 'password123' } })
check('login with updated username', r.status === 200 && !!r.data.token)
r = await req('/api/profile', { token })
check('GET /api/profile shows username', r.data.profile?.username === newUname)

console.log('7. Wallet')
r = await req('/api/wallet', { token })
check('GET /api/wallet (0 balance)', r.status === 200 && r.data.balance === 0)

r = await req('/api/wallet/deposit', { method: 'POST', token, body: { amount: 5000 } })
check('POST /api/wallet/deposit 5000', r.status === 200 && r.data.balance === 5000, JSON.stringify(r.data))

r = await req('/api/wallet/deposit', { method: 'POST', token, body: { amount: -100 } })
check('negative deposit rejected', r.status === 400)

r = await req('/api/wallet', { token })
check('wallet reflects deposit', r.status === 200 && r.data.transactions.length === 1)

r = await req('/api/wallet/withdraw', { method: 'POST', token, body: { amount: 2000 } })
check('POST /api/wallet/withdraw 2000', r.status === 200 && r.data.balance === 3000, JSON.stringify(r.data))

r = await req('/api/wallet/withdraw', { method: 'POST', token, body: { amount: 100000 } })
check('overdraft rejected', r.status === 400)

r = await req('/api/wallet', { token })
check('wallet reflects withdraw', r.status === 200 && r.data.transactions.length === 2)

console.log('7b. Crypto deposits (Ethereum + Solana)')
r = await req('/api/wallet/deposit/crypto', { method: 'POST', token, body: { amount: 500 } })
check('create ETH crypto deposit', r.status === 201 && r.data.deposit?.status === 'pending' && r.data.deposit?.network === 'Ethereum' && !!r.data.deposit?.address, JSON.stringify(r.data).slice(0, 160))
const ethDepositId = r.data.deposit?.id ?? ''
const ethDemo = r.data.deposit?.demo === true
r = await req('/api/wallet/deposit/crypto', { method: 'POST', token, body: { amount: 100, network: 'Solana' } })
check('create SOL crypto deposit', r.status === 201 && r.data.deposit?.network === 'Solana' && !!r.data.deposit?.address, JSON.stringify(r.data).slice(0, 160))
const solDepositId = r.data.deposit?.id ?? ''
r = await req('/api/wallet/deposits', { token })
check('list crypto deposits (2)', r.status === 200 && r.data.deposits?.length === 2)
r = await req('/api/wallet/deposit/crypto', { method: 'POST', token, body: { amount: -5 } })
check('invalid crypto deposit rejected', r.status === 400)
r = await req('/api/wallet/deposit/crypto', { method: 'POST', token, body: { amount: 10, network: 'Bitcoin' } })
check('unsupported network rejected', r.status === 400)
if (ethDemo) {
  r = await req(`/api/wallet/deposits/${ethDepositId}/simulate-transfer`, { method: 'POST', token })
  check('ETH simulate transfer → confirming', r.status === 200 && r.data.status === 'confirming')
  r = await req(`/api/wallet/deposits/${solDepositId}/simulate-transfer`, { method: 'POST', token })
  check('SOL simulate transfer → confirming', r.status === 200 && r.data.status === 'confirming')
  console.log('  waiting 35s for on-chain auto-confirm…')
  await new Promise((resolve) => setTimeout(resolve, 35000))
  r = await req('/api/wallet/deposits', { token })
  check('both deposits auto-confirmed', r.data.deposits?.every((d) => d.status === 'confirmed'), JSON.stringify(r.data).slice(0, 200))
  r = await req('/api/wallet', { token })
  check('wallet credited after crypto confirms', r.data.balance === 3600, `balance=${r.data.balance}`)
} else {
  console.log('  info  real on-chain mode — skipping simulated confirm checks')
}

console.log('8. Bots')
r = await req('/api/bots', { method: 'POST', token, body: { symbol: 'BTCUSDT', strategy: 'momentum', capital: 1000 } })
check('POST /api/bots', r.status === 201 && !!r.data.bot?.id, JSON.stringify(r.data))
const botId = r.data.bot?.id

r = await req('/api/bots', { method: 'POST', token, body: { symbol: 'FOOUSDT', strategy: 'momentum', capital: 1000 } })
check('unsupported symbol rejected', r.status === 400)

r = await req(`/api/bots/${botId}/start`, { method: 'POST', token })
check('POST /api/bots/:id/start', r.status === 200 && r.data.bot?.status === 'running')

// Users must fund their wallet before trading.
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email: `poor-${Date.now()}@example.com`, password: 'password123', name: 'Poor User' },
})
const poorToken = r.data.token
r = await req('/api/bots', { method: 'POST', token: poorToken, body: { symbol: 'BTCUSDT', strategy: 'momentum', capital: 1000 } })
const poorBotId = r.data.bot?.id
r = await req(`/api/bots/${poorBotId}/start`, { method: 'POST', token: poorToken })
check('cannot start bot without funds', r.status === 400, JSON.stringify(r.data))

console.log('9. Market data, portfolio, AI (waiting 14s…)')
await new Promise((resolve) => setTimeout(resolve, 14000))

r = await req('/api/portfolio', { token })
check('GET /api/portfolio (balance 3600)', r.status === 200 && r.data.balance === 3600, JSON.stringify(r.data).slice(0, 160))

r = await req('/api/bots', { token })
const listed = r.data.bots?.[0]
check('bot listed with market price', !!listed?.price, `price=${listed?.price}`)
check('bot data source flag present', typeof listed?.simulated === 'boolean')

r = await req('/api/markets')
check('GET /api/markets (5 symbols)', r.status === 200 && r.data.markets?.length === 5)
check('markets have prices', r.data.markets?.every((m) => m.price != null))
check('markets include history', r.data.markets?.[0]?.history?.length >= 1)

r = await req('/api/ai/analysis?symbol=BTCUSDT', { token })
check('GET /api/ai/analysis', r.status === 200 && ['bullish', 'bearish', 'neutral'].includes(r.data.analysis?.signal))
r = await req('/api/ai/portfolio', { token })
check('GET /api/ai/portfolio', r.status === 200 && typeof r.data.analysis?.riskScore === 'number')
r = await req('/api/ai/recommendations', { token })
check('GET /api/ai/recommendations', r.status === 200 && Array.isArray(r.data.recommendations))

console.log('10. Notifications & price alerts')
r = await req('/api/notifications', { token })
check('GET /api/notifications (security login event)', r.status === 200 && r.data.unread >= 1, JSON.stringify(r.data).slice(0, 160))
r = await req('/api/notifications/alerts', { method: 'POST', token, body: { symbol: 'BTCUSDT', direction: 'above', targetPrice: 1 } })
check('create price alert', r.status === 201 && !!r.data.alert?.id, JSON.stringify(r.data))
r = await req('/api/notifications/alerts', { token })
check('list price alerts', r.status === 200 && r.data.alerts?.length === 1)
const alertId = r.data.alerts?.[0]?.id ?? ''
await new Promise((resolve) => setTimeout(resolve, 6000))
r = await req('/api/notifications/alerts', { token })
check('price alert triggered by engine', r.data.alerts?.[0]?.triggered === true)
r = await req('/api/notifications', { token })
check('price alert notification fired', r.data.notifications?.some((n) => n.type === 'price_alert'))
r = await req(`/api/notifications/alerts/${alertId}`, { method: 'DELETE', token })
check('delete price alert', r.status === 200)

console.log('11. Cleanup')
r = await req(`/api/bots/${botId}/stop`, { method: 'POST', token })
check('POST /api/bots/:id/stop', r.status === 200 && r.data.bot?.status === 'stopped')

console.log('12. Exchanges')
r = await req('/api/exchanges', {
  method: 'POST',
  token,
  body: { exchange: 'binance', label: 'Main', apiKey: 'KEY_ABC123', apiSecret: 'secret_value_xyz' },
})
check('POST /api/exchanges (binance)', r.status === 201 && !!r.data.account?.id, JSON.stringify(r.data))
check('api key is masked', r.data.account?.apiKeyMasked?.includes('••••') === true)
r = await req('/api/exchanges', { token })
check('GET /api/exchanges', r.status === 200 && r.data.accounts?.length === 1)
check('no raw secrets leaked', !JSON.stringify(r.data).includes('secret_value_xyz'))
const accountId = r.data.accounts?.[0]?.id ?? ''
r = await req('/api/exchanges', { method: 'POST', token, body: { exchange: 'nope', apiKey: 'a', apiSecret: 'b' } })
check('unsupported exchange rejected', r.status === 400)
r = await req(`/api/exchanges/${accountId}`, { method: 'DELETE', token })
check('DELETE /api/exchanges/:id', r.status === 200)

console.log('13. Admin')
r = await req('/api/auth/signup', {
  method: 'POST',
  body: { email: 'admin@example.com', password: 'password123', name: 'Admin' },
})
if (r.status === 409) {
  r = await req('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'password123' } })
}
if (r.data?.user?.role === 'admin') {
  const adminToken = r.data.token
  r = await req('/api/admin/stats', { token: adminToken })
  check('admin stats', r.status === 200 && typeof r.data.users === 'number', JSON.stringify(r.data))
  r = await req('/api/admin/users', { token: adminToken })
  check('admin users list', r.status === 200 && Array.isArray(r.data.users))
  r = await req('/api/admin/transactions', { token: adminToken })
  check('admin transactions list', r.status === 200 && Array.isArray(r.data.transactions))
  r = await req('/api/admin/system', { token: adminToken })
  check('admin system info', r.status === 200 && r.data.db === 'ok', JSON.stringify(r.data))
} else {
  console.log('  info  ADMIN_EMAIL not configured — skipping admin role checks')
}
r = await req('/api/admin/stats', { token })
check('non-admin forbidden from admin', r.status === 403)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
