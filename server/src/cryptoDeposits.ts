import crypto from 'node:crypto'
import { pool } from './db'
import { config } from './config'
import { creditDeposit } from './walletService'
import { notifyUser } from './notify'

const USDC_MAINNET = '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const DEMO_CONFIRM_DELAY_SECONDS = 20

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
  return {
    id: d.id,
    asset: d.asset,
    network: d.network,
    address: d.address,
    amountUsd: Number(d.amount_usd),
    status: d.status,
    txHash: d.tx_hash,
    createdAt: d.created_at,
    qrPayload: `ethereum:${d.address}`,
    deepLink: `https://metamask.app.link/send/${d.address}`,
    demo: !config.platformDepositAddress,
  }
}

export async function createCryptoDeposit(
  userId: string,
  amountUsd: number,
): Promise<CryptoDepositRow> {
  // Real mode uses the platform's receiving address. Demo mode derives a
  // stable per-user address so the flow looks and behaves identically.
  const address =
    config.platformDepositAddress ||
    `0x${crypto.createHash('sha256').update(userId).digest('hex').slice(0, 40)}`
  const { rows } = await pool.query<CryptoDepositRow>(
    `INSERT INTO crypto_deposits (user_id, asset, network, address, amount_usd)
     VALUES ($1, 'USDC', 'Ethereum', $2, $3) RETURNING *`,
    [userId, address, amountUsd],
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
    `${Number(deposit.amount_usd).toFixed(2)} USDC confirmed on-chain and added to your wallet.`,
  )
}

/**
 * Watches for deposits and auto-confirms them.
 * - Real mode: polls Etherscan for USDC transfers to the platform address.
 * - Demo mode: auto-confirms simulated transfers after a short delay.
 */
export async function monitorCryptoDeposits(): Promise<void> {
  if (config.platformDepositAddress && config.etherscanApiKey) {
    await monitorOnChain()
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

async function monitorOnChain(): Promise<void> {
  try {
    const url =
      `https://api.etherscan.io/api?module=account&action=tokentx` +
      `&contractaddress=${USDC_MAINNET}` +
      `&address=${config.platformDepositAddress}&page=1&offset=50&sort=desc` +
      `&apikey=${config.etherscanApiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return
    const data = (await res.json()) as {
      result?: { hash: string; value: string; to: string; confirmations: string }[]
    }
    const transfers = data.result ?? []
    const target = config.platformDepositAddress.toLowerCase()

    const { rows } = await pool.query<CryptoDepositRow>(
      `SELECT * FROM crypto_deposits WHERE status IN ('pending', 'confirming')`,
    )
    for (const deposit of rows) {
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
    console.error('[deposits] on-chain monitor error', err)
  }
}
