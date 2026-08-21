import crypto from 'node:crypto'
import { pool } from './db'
import { config } from './config'
import { creditDeposit } from './walletService'
import { notifyUser } from './notify'

export const DEPOSIT_NETWORKS = ['Ethereum', 'Solana'] as const
export type DepositNetwork = (typeof DEPOSIT_NETWORKS)[number]

const USDC_ETH_MAINNET = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const USDC_SOL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const DEMO_CONFIRM_DELAY_SECONDS = 20

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58(bytes: Buffer): string {
  let x = 0n
  for (const b of bytes) x = (x << 8n) | BigInt(b)
  let out = ''
  while (x > 0n) {
    out = BASE58[Number(x % 58n)] + out
    x /= 58n
  }
  return out || '1'
}

export interface CryptoDepositRow {
  id: string
  user_id: string
  asset: string
  network: string
  address: string
  amount_usd: string
  tx_hash: string | null
  status: string
  created_at: Date
  confirmed_at: Date | null
}

/** Public view of a deposit (QR payload + wallet deep link included). */
export function toPublicDeposit(d: CryptoDepositRow) {
  const sol = d.network === 'Solana'
  return {
    id: d.id,
    asset: d.asset,
    network: d.network,
    address: d.address,
    amountUsd: Number(d.amount_usd),
    status: d.status,
    txHash: d.tx_hash,
    createdAt: d.created_at,
    qrPayload: sol ? d.address : `ethereum:${d.address}`,
    deepLink: sol ? 'https://phantom.app/ul/' : `https://metamask.app.link/send/${d.address}`,
    demo: !config.platformDepositAddress && !config.platformSolAddress,
  }
}

export async function createCryptoDeposit(
  userId: string,
  amountUsd: number,
  network: DepositNetwork,
): Promise<CryptoDepositRow> {
  // Real mode uses the platform's receiving address for that network.
  // Demo mode derives a stable per-user address so the flow looks identical.
  let address: string
  if (network === 'Solana') {
    address =
      config.platformSolAddress ||
      base58(crypto.createHash('sha256').update(`sol:${userId}`).digest()).slice(0, 44)
  } else {
    address =
      config.platformDepositAddress ||
      `0x${crypto.createHash('sha256').update(`eth:${userId}`).digest('hex').slice(0, 40)}`
  }
  const { rows } = await pool.query<CryptoDepositRow>(
    `INSERT INTO crypto_deposits (user_id, asset, network, address, amount_usd)
     VALUES ($1, 'USDC', $2, $3, $4) RETURNING *`,
    [userId, network, address, amountUsd],
  )
  return rows[0]
}

export async function listCryptoDeposits(userId: string): Promise<CryptoDepositRow[]> {
  const { rows } = await pool.query<CryptoDepositRow>(
    `SELECT * FROM crypto_deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  )
  return rows
}

/** Demo mode: marks the deposit as sent; the monitor auto-confirms it. */
export async function simulateCryptoTransfer(
  depositId: string,
  userId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE crypto_deposits SET status = 'confirming', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [depositId, userId],
  )
  return (rowCount ?? 0) > 0
}

export async function confirmCryptoDeposit(deposit: CryptoDepositRow): Promise<void> {
  await pool.query(
    `UPDATE crypto_deposits SET status = 'confirmed', confirmed_at = now(),
       tx_hash = COALESCE(tx_hash, 'demo-confirmed')
     WHERE id = $1`,
    [deposit.id],
  )
  await creditDeposit(deposit.user_id, Number(deposit.amount_usd), `crypto:${deposit.id}`)
  await notifyUser(
    deposit.user_id,
    'system',
    'Crypto deposit confirmed',
    `${Number(deposit.amount_usd).toFixed(2)} USDC confirmed on ${deposit.network} and added to your wallet.`,
  )
}

/**
 * Watches for deposits and auto-confirms them.
 * - Ethereum: Etherscan V2 (USDC ERC-20 transfers, 12 confirmations).
 * - Solana: Solana public RPC (USDC SPL transfers).
 * - Demo: auto-confirms simulated transfers after a short delay.
 * On-chain monitors only run when the respective network is configured AND
 * deposits are actually pending — no wasted API calls.
 */
export async function monitorCryptoDeposits(): Promise<void> {
  const ethLive = !!config.platformDepositAddress && !!config.etherscanApiKey
  const solLive = !!config.platformSolAddress

  if (ethLive || solLive) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM crypto_deposits
       WHERE status IN ('pending', 'confirming')`,
    )
    if (rows[0].n === 0) return
    if (ethLive) await monitorEthereum()
    if (solLive) await monitorSolana()
    return
  }

  // Demo: simulate block confirmations for 'confirming' deposits.
  const { rows } = await pool.query<CryptoDepositRow>(
    `SELECT * FROM crypto_deposits WHERE status = 'confirming'
     AND updated_at < now() - make_interval(secs => $1)`,
    [DEMO_CONFIRM_DELAY_SECONDS],
  )
  for (const deposit of rows) {
    await confirmCryptoDeposit(deposit)
  }
}

async function openDeposits(network: string): Promise<CryptoDepositRow[]> {
  const { rows } = await pool.query<CryptoDepositRow>(
    `SELECT * FROM crypto_deposits
     WHERE status IN ('pending', 'confirming') AND network = $1`,
    [network],
  )
  return rows
}

async function monitorEthereum(): Promise<void> {
  const deposits = await openDeposits('Ethereum')
  if (deposits.length === 0) return // no Etherscan call needed
  try {
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx` +
      `&contractaddress=${USDC_ETH_MAINNET}` +
      `&address=${config.platformDepositAddress}&page=1&offset=50&sort=desc` +
      `&apikey=${config.etherscanApiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return
    const data = (await res.json()) as {
      result?: { hash: string; value: string; to: string; confirmations: string }[]
    }
    const transfers = data.result ?? []
    const target = config.platformDepositAddress.toLowerCase()
    for (const deposit of deposits) {
      const amountUnits = Math.round(Number(deposit.amount_usd) * 1e6) // USDC: 6 decimals
      const match = transfers.find(
        (t) => t.to?.toLowerCase() === target && Number(t.value) === amountUnits,
      )
      if (match && Number(match.confirmations) >= 12) {
        await pool.query('UPDATE crypto_deposits SET tx_hash = $1 WHERE id = $2', [
          match.hash,
          deposit.id,
        ])
        await confirmCryptoDeposit(deposit)
      }
    }
  } catch (err) {
    console.error('[deposits] ethereum monitor error', err)
  }
}

async function monitorSolana(): Promise<void> {
  const deposits = await openDeposits('Solana')
  if (deposits.length === 0) return // no RPC calls needed
  const address = config.platformSolAddress!
  try {
    const signatures = (await solanaRpc('getSignaturesForAddress', [
      address,
      { limit: 10 },
    ])) as { signature: string }[] | null
    if (!Array.isArray(signatures)) return
    for (const sig of signatures) {
      const tx = (await solanaRpc('getTransaction', [
        sig.signature,
        { maxSupportedTransactionVersion: 0 },
      ])) as SolanaTx | null
      if (!tx?.meta) continue
      const pre = tx.meta.preTokenBalances ?? []
      const post = tx.meta.postTokenBalances ?? []
      for (const b of post) {
        if (
          b.mint !== USDC_SOL_MINT ||
          (b.owner ?? '').toLowerCase() !== address.toLowerCase()
        ) {
          continue
        }
        const before =
          pre.find((p) => p.accountIndex === b.accountIndex)?.uiTokenAmount?.uiAmount ?? 0
        const amount = (b.uiTokenAmount?.uiAmount ?? 0) - before
        if (amount <= 0) continue
        const match = deposits.find(
          (d) => Math.abs(Number(d.amount_usd) - amount) < 0.01,
        )
        if (match) {
          await pool.query('UPDATE crypto_deposits SET tx_hash = $1 WHERE id = $2', [
            sig.signature,
            match.id,
          ])
          await confirmCryptoDeposit(match)
        }
      }
    }
  } catch (err) {
    console.error('[deposits] solana monitor error', err)
  }
}

interface SolanaTx {
  meta?: {
    preTokenBalances?: { accountIndex: number; uiTokenAmount?: { uiAmount?: number } }[]
    postTokenBalances?: {
      accountIndex: number
      mint: string
      owner?: string
      uiTokenAmount?: { uiAmount?: number }
    }[]
  }
}

async function solanaRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(config.solanaRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`solana rpc ${res.status}`)
  const data = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (data.error) throw new Error(`solana rpc error: ${data.error.message}`)
  return data.result
}
