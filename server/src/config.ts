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
}
