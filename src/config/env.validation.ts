import * as Joi from 'joi';
import { WINDOWS_NAMED_PIPE_PATTERN } from './listen-endpoint';

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
  then: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  otherwise: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
});

export const envValidationSchema = Joi.object({
  // Base
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  // Numeric TCP port on Linux/Vercel, or an IISNode named-pipe path on
  // Windows/Plesk (`\\.\pipe\...`). The pipe value must survive untouched.
  PORT: Joi.alternatives()
    .try(
      Joi.number().integer().positive().max(65535),
      Joi.string()
        .trim()
        .pattern(WINDOWS_NAMED_PIPE_PATTERN)
        .message(
          'PORT must be a numeric TCP port (1-65535) or a Windows named-pipe path (e.g. \\\\.\\pipe\\iisnode)',
        ),
    )
    .default(3000),
  // Optional numeric TCP override, used as the local fallback when IISNode
  // supplies PORT as a named pipe. Never accepts a pipe path.
  APP_PORT: Joi.number().integer().positive().max(65535).empty('').optional(),
  FRONTEND_URL: Joi.string().uri().default('https://www.dunastravel.com'),
  CORS_ALLOWED_ORIGINS: Joi.string().default(
    'https://www.dunastravel.com,https://admin.dunastravel.com',
  ),
  ADMIN_DASHBOARD_BASE_URL: Joi.string()
    .uri()
    .default('https://admin.dunastravel.com'),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(3).default(0),

  // DB
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string()
      .uri()
      .default('postgresql://localhost:5432/dunastravel'),
  }),
  REDIS_URL: Joi.when('NODE_ENV', {
    is: 'production',
    // Auth lockout state, throttling and the shared cache all require Redis,
    // so a missing value must fail validation instead of silently using
    // localhost (which does not exist on Plesk).
    then: Joi.string()
      .uri({ scheme: ['redis', 'rediss'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['redis', 'rediss'] })
      .default('redis://localhost:6379'),
  }),

  // Auth
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: strongSecret.required(),
    otherwise: strongSecret.default(
      'r6kbq8LwyHF1cMNEAGgVUzBTCiKIQRl9vfhYX2ad7PjSJon5Z4Wpmu0x3tseOD',
    ),
  }),
  JWT_REFRESH_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: strongSecret.invalid(Joi.ref('JWT_SECRET')).required().messages({
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
  PII_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string()
      .pattern(/^[a-fA-F0-9]{64}$/)
      .required(),
    otherwise: Joi.string()
      .pattern(/^[a-fA-F0-9]{64}$/)
      .optional()
      .allow(''),
  }),
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

  // Auth Verification & Bot Defense
  AUTH_REQUIRE_EMAIL_VERIFICATION: Joi.string()
    .valid('true', 'false')
    .default('true'),
  TURNSTILE_SECRET_KEY: Joi.string().optional().allow(''),
  TURNSTILE_SITE_KEY: Joi.string().optional().allow(''),
  SKIP_TURNSTILE: Joi.string().valid('true', 'false').default('false'),
  ENFORCE_TURNSTILE: Joi.string().valid('true', 'false').default('false'),

  MAIL_TRANSPORT: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('resend').default('resend'),
    otherwise: Joi.string().valid('resend', 'mock').default('mock'),
  }),

  RESEND_API_KEY: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .pattern(/^re_[a-zA-Z0-9_]{8,}$/)
      .required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  MAIL_FROM_ADDRESS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  MAIL_FROM_NAME: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().max(100).optional().allow(''),
  }),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  // Media (Cloudinary)
  CLOUDINARY_CLOUD_NAME: Joi.when('NODE_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  CLOUDINARY_API_KEY: Joi.when('NODE_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  CLOUDINARY_API_SECRET: Joi.when('NODE_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(''),
  }),

  // Currency
  OPENEXCHANGERATES_APP_ID: Joi.string().optional().allow(''),

  // PayLink remains fail-closed unless the selected backend runtime has the
  // real dashboard-issued credentials and registered callback URLs.
  PAYMENT_PROVIDER: Joi.string()
    .valid('DISABLED', 'GETPAYIN')
    .default('DISABLED'),
  PUBLIC_API_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://dunastravel-backend-seven.vercel.app'),
  GETPAYIN_MODE: Joi.string().valid('sandbox', 'production').default('sandbox'),
  GETPAYIN_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://pay.getpayin.com'),
  GETPAYIN_AUTH_TOKEN: Joi.string().optional().allow(''),
  GETPAYIN_HASH_TOKEN: Joi.string().optional().allow(''),
  GETPAYIN_REDIRECT_URL: Joi.when('PAYMENT_PROVIDER', {
    is: 'GETPAYIN',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  GETPAYIN_WEBHOOK_URL: Joi.when('PAYMENT_PROVIDER', {
    is: 'GETPAYIN',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  GETPAYIN_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(30000),
  GETPAYIN_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(2),
  // Deprecated semantic aliases retained temporarily for existing deployments.
  GETPAYIN_API_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional()
    .allow(''),
  GETPAYIN_API_KEY: Joi.string().optional().allow(''),
  GETPAYIN_WEBHOOK_SECRET: Joi.string().optional().allow(''),

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
})
  .custom((value: Record<string, unknown>, helpers) => {
    if (value.PAYMENT_PROVIDER !== 'GETPAYIN') return value;
    if (!value.GETPAYIN_AUTH_TOKEN && !value.GETPAYIN_API_KEY) {
      return helpers.message({ custom: 'GETPAYIN_AUTH_TOKEN is required' });
    }
    if (!value.GETPAYIN_HASH_TOKEN && !value.GETPAYIN_WEBHOOK_SECRET) {
      return helpers.message({ custom: 'GETPAYIN_HASH_TOKEN is required' });
    }
    return value;
  }, 'PayLink credential alias validation')
  .options({ presence: 'optional' });
