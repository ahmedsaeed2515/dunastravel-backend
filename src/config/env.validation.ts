import * as Joi from 'joi';

const strongSecret = Joi.string()
  .min(48)
  .max(512)
  .custom((value: string, helpers) => {
    if (
      /your|example|change.?me|placeholder|replace|generate_a_/i.test(value) ||
      new Set(value).size < 16
    ) {
      return helpers.error('string.weakSecret');
    }
    return value;
  }, 'high entropy secret validation');

const productionHttpsUrl = Joi.when('NODE_ENV', {
  is: Joi.valid('production', 'staging'),
  then: Joi.string().uri({ scheme: ['https'] }).required(),
  otherwise: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
});

export const envValidationSchema = Joi.object({
  // Base
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().integer().positive().default(3000),
  FRONTEND_URL: Joi.string().uri().default('https://www.dunastravel.com'),
  CORS_ALLOWED_ORIGINS: Joi.string()
    .default('https://www.dunastravel.com,https://admin.dunastravel.com'),
  ADMIN_DASHBOARD_BASE_URL: Joi.string().uri().default('https://admin.dunastravel.com'),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(3).default(0),

  // DB
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string()
      .uri()
      .default('postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'),
  }),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://default:gQAAAAAAAcqkAAIgcDI5ODA2MDY3MzliN2E0Y2MwOWE5OWZhZjYzYWU3N2IwNA@star-raccoon-117412.upstash.io:6379'),

  // Auth
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: strongSecret.required(),
    otherwise: strongSecret.default('r6kbq8LwyHF1cMNEAGgVUzBTCiKIQRl9vfhYX2ad7PjSJon5Z4Wpmu0x3tseOD'),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: strongSecret
      .invalid(Joi.ref('JWT_SECRET'))
      .required()
      .messages({
        'any.invalid':
          'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different values',
      }),
    otherwise: strongSecret
      .invalid(Joi.ref('JWT_SECRET'))
      .default('txhE6ViYpeRo7cqKPXn4d5M938LTbQuWgHNlBICfFAaJvzSmD1yk2ZOGsrU0wj')
      .messages({
        'any.invalid':
          'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different values',
      }),
  }),
  GUEST_TOKEN_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: strongSecret
      .invalid(Joi.ref('JWT_SECRET'), Joi.ref('JWT_REFRESH_SECRET'))
      .required()
      .messages({
        'any.invalid':
          'FATAL: GUEST_TOKEN_SECRET must be different from JWT_SECRET and JWT_REFRESH_SECRET',
      }),
    otherwise: strongSecret
      .invalid(Joi.ref('JWT_SECRET'), Joi.ref('JWT_REFRESH_SECRET'))
      .default('guest_token_secret_dunas_default_fallback_entropy_32chars_long')
      .messages({
        'any.invalid':
          'FATAL: GUEST_TOKEN_SECRET must be different from JWT_SECRET and JWT_REFRESH_SECRET',
      }),
  }),
  PII_ENCRYPTION_KEY: Joi.string()
    .pattern(/^[a-fA-F0-9]{64}$/)
    .optional()
    .allow(''),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),
  JWT_ISSUER: Joi.string().min(3).max(100).default('dunas-travel-api'),
  JWT_AUDIENCE: Joi.string().min(3).max(100).default('dunas-travel-clients'),

  // Logging & Limits
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
  REQUEST_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  THROTTLE_TTL: Joi.number().integer().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  MANAGED_BACKUPS_CONFIRMED: Joi.string()
    .valid('true', 'false')
    .default('false'),

  MAIL_TRANSPORT: Joi.string()
    .valid('resend', 'mock')
    .optional()
    .default('mock'),

  // Mail keys — optional so startup doesn't crash if not configured yet
  RESEND_API_KEY: Joi.string().optional().allow(''),
  MAIL_FROM_ADDRESS: Joi.string().optional().allow(''),
  MAIL_FROM_NAME: Joi.string().max(100).optional().allow(''),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.string().optional().allow(''),

  // Media (Cloudinary)
  CLOUDINARY_CLOUD_NAME: Joi.string().default('u7xf91gp'),
  CLOUDINARY_API_KEY: Joi.string().default('883146814559189'),
  CLOUDINARY_API_SECRET: Joi.string().default('rb359FxDNY_qUkI44RJgKDBopuA'),

  // Currency
  OPENEXCHANGERATES_APP_ID: Joi.string().optional().allow(''),

  // Stripe — optional so build and serverless boot pass even if Stripe is not yet configured in Vercel
  STRIPE_SECRET_KEY: Joi.string()
    .pattern(/^(sk_live_|sk_test_)[A-Za-z0-9_]+$/)
    .optional()
    .allow(''),
  STRIPE_WEBHOOK_SECRET: Joi.string()
    .pattern(/^whsec_[A-Za-z0-9_]+$/)
    .optional()
    .allow(''),

  // AI Platform
  AI_PROVIDER: Joi.string().optional(),
  AI_PUBLIC_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  ANTHROPIC_API_KEY: Joi.string().when('AI_PROVIDER', {
    is: 'anthropic',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  ANTHROPIC_MODEL: Joi.string().when('AI_PROVIDER', {
    is: 'anthropic',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  AI_MAX_OUTPUT_TOKENS: Joi.number()
    .integer()
    .positive()
    .optional()
    .default(1024),
  AI_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .positive()
    .optional()
    .default(15000),
  AI_DAILY_QUOTA_PER_ADMIN: Joi.number()
    .integer()
    .positive()
    .optional()
    .default(50),
}).options({ presence: 'optional' });
