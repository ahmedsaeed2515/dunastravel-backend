import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Base
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .default('development'),
  PORT: Joi.number().integer().positive().default(3000),
  FRONTEND_URL: Joi.string().uri().required(),
  CORS_ALLOWED_ORIGINS: Joi.string().required(),
  ADMIN_DASHBOARD_BASE_URL: Joi.string().uri().required(),

  // DB
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid(Joi.ref('JWT_SECRET'))
    .required()
    .messages({
      'any.invalid':
        'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different values',
    }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Logging & Limits
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
  REQUEST_TIMEOUT_MS: Joi.number().integer().positive().default(30000),
  THROTTLE_TTL: Joi.number().integer().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),

  // Mail
  RESEND_API_KEY: Joi.string()
    .pattern(/^re_[a-zA-Z0-9_]{8,}$/)
    .required(),
  MAIL_FROM_ADDRESS: Joi.string().email().required(),
  MAIL_FROM_NAME: Joi.string().max(100).required(),
  MAIL_INTERNAL_ALERT_RECIPIENT: Joi.string().email().required(),
  MAIL_TRANSPORT: Joi.string().valid('resend', 'mock').optional(),

  // Media (Cloudinary)
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // Currency
  OPENEXCHANGERATES_APP_ID: Joi.string().required(),

  // Stripe
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),

  // AI Platform
  AI_PROVIDER: Joi.string().optional(),
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
