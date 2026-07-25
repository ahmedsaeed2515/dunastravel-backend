export default () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  frontendUrl: process.env.FRONTEND_URL,
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  auth: {
    guestTokenSecret: process.env.GUEST_TOKEN_SECRET,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  mail: {
    apiKey: process.env.RESEND_API_KEY,
    fromAddress: process.env.MAIL_FROM_ADDRESS,
    fromName: process.env.MAIL_FROM_NAME,
    internalAlertRecipient: process.env.MAIL_INTERNAL_ALERT_RECIPIENT,
    transport:
      process.env.MAIL_TRANSPORT ||
      (process.env.NODE_ENV === 'production' ? 'resend' : 'mock'),
    adminDashboardBaseUrl: process.env.ADMIN_DASHBOARD_BASE_URL,
  },
  currency: {
    openExchangeRatesAppId: process.env.OPENEXCHANGERATES_APP_ID,
  },
});
