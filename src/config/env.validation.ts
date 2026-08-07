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
  FRONTEND_URL: productionHttpsUrl,
  CORS_ALLOWED_ORIGINS: Joi.string()
    .required()
    .custom((value: string, helpers) => {
      const origins = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (!origins.length || new Set(origins).size !== origins.length) {
        return helpers.error('string.invalidOrigins');
      }
      try {
        for (const origin of origins) {
          const url = new URL(origin);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.origin !== origin ||
            origin.includes('*')
          ) {
            return helpers.error('string.invalidOrigins');
          }
        }
      } catch {
        return helpers.error('string.invalidOrigins');
      }
      return value;
    }, 'exact CORS origin validation'),
  ADMIN_DASHBOARD_BASE_URL: productionHttpsUrl,
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(3).default(0),

  // DB
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required()
    .custom((value: string, helpers) => {
      const environment = helpers.state.ancestors[0]?.NODE_ENV;
      const url = new URL(value);
      if (
        (environment === 'production' || environment === 'staging') &&
        !url.password
      ) {
        return helpers.error('string.redisPasswordRequired');
      }
      return value;
    }, 'production Redis authentication validation'),

  // Auth
  JWT_SECRET: strongSecret.required(),
  JWT_REFRESH_SECRET: strongSecret
    .invalid(Joi.ref('JWT_SECRET'))
    .required()
    .messages({
      'any.invalid':
        'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different values',
    }),
  GUEST_TOKEN_SECRET: strongSecret
    .invalid(Joi.ref('JWT_SECRET'), Joi.ref('JWT_REFRESH_SECRET'))
    .default('guest_token_secret_dunas_default_fallback_entropy_32chars_long')
    .messages({
      'any.invalid':
        'FATAL: GUEST_TOKEN_SECRET must be different from JWT_SECRET and JWT_REFRESH_SECRET',
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
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.valid('resend').required(),
      otherwise: Joi.optional(),
    }),

  // Mail keys — optional so startup doesn't crash if not configured yet
  RESEND_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  MAIL_FROM_ADDRESS: Joi.string().email().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  MAIL_FROM_NAME: Joi.string().max(100).optional().allow(''),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.string().email().optional().allow(''),

  // Media (Cloudinary)
  CLOUDINARY_CLOUD_NAME: Joi.string()
    .invalid('your_cloud_name')
    .required(),
  CLOUDINARY_API_KEY: Joi.string().invalid('your_api_key').required(),
  CLOUDINARY_API_SECRET: Joi.string()
    .min(20)
    .invalid('your_api_secret')
    .required(),

  // Currency
  OPENEXCHANGERATES_APP_ID: Joi.string().optional().allow(''),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().pattern(/^sk_live_[A-Za-z0-9]+$/).required(),
    otherwise: Joi.string().optional().allow(''),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().pattern(/^whsec_[A-Za-z0-9]+$/).required(),
    otherwise: Joi.string().optional().allow(''),
  }),

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
