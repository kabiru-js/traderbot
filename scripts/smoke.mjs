// End-to-end smoke test against a running API (node scripts/smoke.mjs).
// Requires the API on http://localhost:8787 with a database available.

const base = 'http://localhost:8787'
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

const email = `smoke-${Date.now()}@example.com`

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

console.log('3. Wallet')
r = await req('/api/wallet', { token })
check('GET /api/wallet (0 balance)', r.status === 200 && r.data.balance === 0)

r = await req('/api/wallet/deposit', { method: 'POST', token, body: { amount: 5000 } })
check('POST /api/wallet/deposit 5000', r.status === 200 && r.data.balance === 5000, JSON.stringify(r.data))

r = await req('/api/wallet/deposit', { method: 'POST', token, body: { amount: -100 } })
check('negative deposit rejected', r.status === 400)

r = await req('/api/wallet', { token })
check('wallet reflects deposit', r.status === 200 && r.data.transactions.length === 1)

console.log('4. Bots')
r = await req('/api/bots', { method: 'POST', token, body: { symbol: 'BTCUSDT', strategy: 'momentum', capital: 1000 } })
check('POST /api/bots', r.status === 201 && !!r.data.bot?.id, JSON.stringify(r.data))
const botId = r.data.bot?.id

r = await req('/api/bots', { method: 'POST', token, body: { symbol: 'FOOUSDT', strategy: 'momentum', capital: 1000 } })
check('unsupported symbol rejected', r.status === 400)

r = await req(`/api/bots/${botId}/start`, { method: 'POST', token })
check('POST /api/bots/:id/start', r.status === 200 && r.data.bot?.status === 'running')

console.log('5. Portfolio (waiting 14s for market price…)')
await new Promise((resolve) => setTimeout(resolve, 14000))
r = await req('/api/portfolio', { token })
check('GET /api/portfolio', r.status === 200 && r.data.balance === 5000, JSON.stringify(r.data).slice(0, 200))
console.log(`  info  market price: ${r.data.openPositions?.[0]?.price ?? 'n/a'}`)

r = await req('/api/bots', { token })
const listed = r.data.bots?.[0]
check('bot listed with market price', !!listed?.price, `price=${listed?.price}`)
check('bot simulated flag present', typeof listed?.simulated === 'boolean', `simulated=${listed?.simulated}`)
check('bot status running', listed?.status === 'running')

console.log('6. Cleanup')
r = await req(`/api/bots/${botId}/stop`, { method: 'POST', token })
check('POST /api/bots/:id/stop', r.status === 200 && r.data.bot?.status === 'stopped')

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
