import { envValidationSchema } from './env.validation';

describe('Environment Validation Schema', () => {
  it('should validate a complete valid env', () => {
    const validEnv = {
      NODE_ENV: 'production',
      PORT: '3000',
      FRONTEND_URL: 'https://example.test',
      CORS_ALLOWED_ORIGINS: 'https://example.test',
      ADMIN_DASHBOARD_BASE_URL: 'https://admin.example.test',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/db',
      REDIS_URL: 'rediss://default:redis-password@redis.example.test:6379',
      JWT_SECRET:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET:
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      GUEST_TOKEN_SECRET:
        '89abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      PII_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      JWT_EXPIRES_IN: '15m',
      LOG_LEVEL: 'info',
      REQUEST_TIMEOUT_MS: '30000',
      THROTTLE_TTL: '60000',
      THROTTLE_LIMIT: '100',
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_12345678901234567890',
      MAIL_FROM_ADDRESS: 'test@test.com',
      MAIL_FROM_NAME: 'Test',
      MAIL_INTERNAL_ALERT_RECIPIENT: 'alert@test.com',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'cloudinary-secret-value-123456',
      OPENEXCHANGERATES_APP_ID: 'test',

    };

    const res = envValidationSchema.validate(validEnv);
    const validatedValue = res.value as Record<string, unknown>;
    expect(res.error).toBeUndefined();
    expect(validatedValue.PORT).toBe(3000);
  });

  it('should reject missing required vars including GUEST_TOKEN_SECRET', () => {
    const invalidEnv = {
      NODE_ENV: 'production',
    };

    const { error } = envValidationSchema.validate(invalidEnv, {
      abortEarly: false,
    });
    expect(error).toBeDefined();
    expect(error?.details.some((d) => d.context?.key === 'DATABASE_URL')).toBe(
      true,
    );
    expect(error?.details.some((d) => d.context?.key === 'JWT_SECRET')).toBe(
      true,
    );
    expect(
      error?.details.some((d) => d.context?.key === 'GUEST_TOKEN_SECRET'),
    ).toBe(true);
  });

  it('should reject GUEST_TOKEN_SECRET if identical to JWT_SECRET or JWT_REFRESH_SECRET', () => {
    const sameSecretEnv = {
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://example.test',
      CORS_ALLOWED_ORIGINS: 'https://example.test',
      ADMIN_DASHBOARD_BASE_URL: 'https://admin.example.test',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/db',
      REDIS_URL: 'rediss://default:redis-password@redis.example.test:6379',
      JWT_SECRET:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      JWT_REFRESH_SECRET:
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      GUEST_TOKEN_SECRET:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      PII_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      CLOUDINARY_CLOUD_NAME: 'test',
      CLOUDINARY_API_KEY: 'test',
      CLOUDINARY_API_SECRET: 'cloudinary-secret-value-123456',
      MAIL_TRANSPORT: 'resend',
      RESEND_API_KEY: 're_12345678901234567890',
      MAIL_FROM_ADDRESS: 'test@test.com',

    };

    const { error } = envValidationSchema.validate(sameSecretEnv);
    expect(error).toBeDefined();
    expect(
      error?.details.some((d) => d.context?.key === 'GUEST_TOKEN_SECRET'),
    ).toBe(true);
  });

  it('should validate NODE_ENV enum', () => {
    const { error } = envValidationSchema.validate({ NODE_ENV: 'invalid' });
    expect(error).toBeDefined();
    expect(error?.details[0].message).toContain('NODE_ENV');
  });
});
