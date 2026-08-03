import fs from 'node:fs'
import path from 'node:path'
import { Pool, type PoolClient } from 'pg'

// Assigned by initDb() before any query runs (see index.ts main()).
export let pool!: Pool

/**
 * Resolves the connection string:
 *  - DATABASE_URL when set (Neon / Supabase / Railway / Docker Postgres)
 *  - otherwise an embedded PGlite instance (zero-setup local dev)
 */
async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  try {
    const { PGlite } = await import('@electric-sql/pglite')
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')
    const dataDir = path.join(__dirname, '..', '.pglite')
    const db = await PGlite.create({ dataDir })
    const server = new PGLiteSocketServer({ db, port: 5433, host: '127.0.0.1' })
    await server.start()
    process.on('exit', () => void server.stop())
    console.log('[db] embedded Postgres (PGlite) ready on 127.0.0.1:5433')
    console.log('[db] set DATABASE_URL to use an external Postgres instead')
    return 'postgresql://postgres:postgres@127.0.0.1:5433/postgres'
  } catch (err) {
    const detail = err instanceof Error ? ` (${err.message})` : ''
    throw new Error(
      'DATABASE_URL is required: set it to a Postgres connection string ' +
        '(Neon/Supabase/Railway), or install dev dependencies for the ' +
        'embedded database.' + detail,
    )
  }
}

/** Creates the connection pool. Must run before any query. */
export async function initDb(): Promise<void> {
  if (pool) return
  const url = await resolveDatabaseUrl()
  const needsSsl =
    url.includes('sslmode') || /neon\.tech|supabase\.co/.test(url)
  pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  })
}

/** Applies server/schema.sql (idempotent). */
export async function ensureSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, '..', 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  await pool.query(sql)
}

/** Runs a callback inside a transaction. */
export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
