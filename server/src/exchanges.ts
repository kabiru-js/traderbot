import { pool } from './db'
import { decryptSecret } from './security'

export const SUPPORTED_EXCHANGES = ['binance', 'bybit', 'kraken', 'okx', 'coinbase']

export interface ExchangeAccountRow {
  id: string
  user_id: string
  exchange: string
  label: string | null
  api_key_enc: string
  api_secret_enc: string
  created_at: Date
}

function maskKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : '••••'
}

/** Public view of an account — never exposes the raw secret. */
export function toPublic(row: ExchangeAccountRow) {
  return {
    id: row.id,
    exchange: row.exchange,
    label: row.label,
    apiKeyMasked: maskKey(decryptSecret(row.api_key_enc)),
    createdAt: row.created_at,
  }
}

/**
 * Exchange adapters. Execution is paper-only for now — accounts are stored
 * for future balance sync / execution once real API trading is enabled.
 * Each exchange can expose: testConnection(), getBalances().
 */
export interface ExchangeAdapter {
  name: string
  testConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; detail?: string }>
}

const paperAdapter = (name: string): ExchangeAdapter => ({
  name,
  async testConnection() {
    return { ok: false, detail: `${name}: live API validation requires a reachable exchange endpoint — connection saved, execution stays paper.` }
  },
})

export const adapters: Record<string, ExchangeAdapter> = Object.fromEntries(
  SUPPORTED_EXCHANGES.map((name) => [name, paperAdapter(name)]),
)

export async function listAccounts(userId: string) {
  const { rows } = await pool.query<ExchangeAccountRow>(
    'SELECT * FROM exchange_accounts WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  )
  return rows.map(toPublic)
}
