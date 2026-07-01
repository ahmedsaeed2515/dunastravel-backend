"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (function () {
    var _a, _b, _c, _d;
    return ({
        port: parseInt((_a = process.env.PORT) !== null && _a !== void 0 ? _a : '5000', 10),
        nodeEnv: (_b = process.env.NODE_ENV) !== null && _b !== void 0 ? _b : 'development',
        corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
        frontendUrl: process.env.FRONTEND_URL,
        database: {
            url: process.env.DATABASE_URL,
        },
        redis: {
            url: (_c = process.env.REDIS_URL) !== null && _c !== void 0 ? _c : 'redis://localhost:6379',
        },
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: (_d = process.env.JWT_EXPIRES_IN) !== null && _d !== void 0 ? _d : '7d',
        },
        anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY,
        },
        mail: {
            apiKey: process.env.RESEND_API_KEY,
            fromAddress: process.env.MAIL_FROM_ADDRESS,
            fromName: process.env.MAIL_FROM_NAME,
            internalAlertRecipient: process.env.MAIL_INTERNAL_ALERT_RECIPIENT,
            transport: process.env.MAIL_TRANSPORT ||
                (process.env.NODE_ENV === 'production' ? 'resend' : 'mock'),
            adminDashboardBaseUrl: process.env.ADMIN_DASHBOARD_BASE_URL,
        },
        currency: {
            openExchangeRatesAppId: process.env.OPENEXCHANGERATES_APP_ID,
        },
    });
});
