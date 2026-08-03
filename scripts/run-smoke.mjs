// Spawns the API (with its embedded database), runs scripts/smoke.mjs
// against it, then tears everything down.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.join(root, '..', 'server')

const server = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let log = ''
server.stdout.on('data', (d) => (log += d.toString()))
server.stderr.on('data', (d) => (log += d.toString()))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let ready = false
for (let i = 0; i < 120; i++) {
  await wait(1000)
  try {
    const res = await fetch('http://localhost:8787/api/health')
    if (res.ok) {
      ready = true
      break
    }
  } catch {
    // not up yet
  }
}

if (!ready) {
  console.error('Server did not become ready. Log:\n' + log.slice(-4000))
  server.kill()
  process.exit(1)
}

console.log('Server ready — running smoke test…\n')

const smoke = spawn(process.execPath, [path.join(root, 'smoke.mjs')], {
  stdio: 'inherit',
})

const timeout = setTimeout(() => {
  console.error('Smoke test timed out.')
  server.kill()
  process.exit(1)
}, 120000)

smoke.on('exit', (code) => {
  clearTimeout(timeout)
  server.kill()
  console.log('\n--- server log tail ---\n' + log.slice(-2000))
  process.exit(code ?? 1)
})
