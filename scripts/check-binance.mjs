// Quick check: can we reach Binance's public market-data WebSocket?
import WebSocket from 'ws'

const url = 'wss://stream.binance.com:9443/ws/btcusdt@aggTrade'
console.log(`Connecting to ${url}…`)
const ws = new WebSocket(url)
const timer = setTimeout(() => {
  console.log('TIMEOUT — no data within 15s')
  ws.terminate()
  process.exit(1)
}, 15000)

ws.on('open', () => console.log('Socket OPEN'))
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString())
  console.log('RECEIVED PRICE:', msg.p)
  clearTimeout(timer)
  ws.close()
  process.exit(0)
})
ws.on('error', (err) => {
  console.log('ERROR:', err.message)
  clearTimeout(timer)
  process.exit(1)
})
ws.on('close', (code) => console.log('CLOSED', code))
