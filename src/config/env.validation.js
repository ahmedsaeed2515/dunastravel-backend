"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.envValidationSchema = void 0;
var Joi = __importStar(require("joi"));
exports.envValidationSchema = Joi.object({
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
        'any.invalid': 'FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different values',
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
