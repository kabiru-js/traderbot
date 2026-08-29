import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '8787', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // When true (default), wallet deposits credit instantly for demo purposes.
  demoMode: process.env.DEMO_MODE !== 'false',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // Absolute path to the built frontend to serve statically (optional).
  frontendDist: process.env.FRONTEND_DIST || '',
  // Public base URL used in verification/reset links (Render URL in prod).
  appUrl: process.env.APP_URL || 'http://localhost:8443',
  // Email delivery (Resend). Without a key, emails are logged instead.
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'Nexora AI <onboarding@resend.dev>',
  // Encryption key for exchange API secrets (any string; hashed to 32 bytes).
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-me',
  // Email that gets the admin role on signup.
  adminEmail: process.env.ADMIN_EMAIL || '',
  // Optional OpenAI-compatible provider for AI analysis.
  aiApiUrl: process.env.AI_API_URL || '',
  aiApiKey: process.env.AI_API_KEY || '',
  // Crypto-native deposits: platform receiving addresses + on-chain keys.
  // Without these, deposits run in demo mode (auto-confirmed after simulation).
  platformDepositAddress: process.env.PLATFORM_DEPOSIT_ADDRESS || '', // USDC ERC-20 (Ethereum)
  platformSolAddress: process.env.PLATFORM_SOL_ADDRESS || '', // USDC SPL (Solana)
  etherscanApiKey: process.env.ETHERSCAN_API_KEY || '',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  // Mock funds seeded into one-click demo accounts.
  demoSeedBalance: Number(process.env.DEMO_SEED_BALANCE || 10000),
}
