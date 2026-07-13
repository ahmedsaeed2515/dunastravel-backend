import { envValidationSchema } from './env.validation';

describe('Environment Validation Schema', () => {
  it('should validate a complete valid env', () => {
    const validEnv = {
      NODE_ENV: 'production',
      PORT: '3000',
      FRONTEND_URL: 'http://localhost:3001',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3001',
      ADMIN_DASHBOARD_BASE_URL: 'http://localhost:3002',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
      JWT_REFRESH_SECRET:
        'super-secret-refresh-key-that-is-at-least-32-chars-long',
      JWT_EXPIRES_IN: '15m',
      LOG_LEVEL: 'info',
      REQUEST_TIMEOUT_MS: '30000',
      THROTTLE_TTL: '60000',
      THROTTLE_LIMIT: '100',
      RESEND_API_KEY: 're_123456789',
      MAIL_FROM_ADDRESS: 'test@test.com',
      MAIL_FROM_NAME: 'Test',
      MAIL_INTERNAL_ALERT_RECIPIENT: 'alert@test.com',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'test',
      OPENEXCHANGERATES_APP_ID: 'test',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    };

    const { error, value } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
    // Port coerced to number
    expect(value.PORT).toBe(3000);
  });

  it('should reject missing required vars', () => {
    const invalidEnv = {
      NODE_ENV: 'production',
      // Missing DATABASE_URL, JWT_SECRET, etc.
    };

    const { error } = envValidationSchema.validate(invalidEnv, {
      abortEarly: false,
    });
    expect(error).toBeDefined();
    expect(error!.details.some((d) => d.context?.key === 'DATABASE_URL')).toBe(
      true,
    );
    expect(error!.details.some((d) => d.context?.key === 'JWT_SECRET')).toBe(
      true,
    );
  });

  it('should validate NODE_ENV enum', () => {
    const { error } = envValidationSchema.validate({ NODE_ENV: 'invalid' });
    expect(error).toBeDefined();
    expect(error!.details[0].message).toContain('NODE_ENV');
  });
});
