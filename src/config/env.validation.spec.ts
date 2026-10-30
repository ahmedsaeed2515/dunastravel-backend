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

  it('should reject the mock mail transport in production', () => {
    const { error } = envValidationSchema.validate(
      { NODE_ENV: 'production', MAIL_TRANSPORT: 'mock' },
      { abortEarly: false },
    );

    expect(
      error?.details.some((detail) => detail.context?.key === 'MAIL_TRANSPORT'),
    ).toBe(true);
  });

  it('keeps payments disabled by default and rejects unknown providers', () => {
    const valid = envValidationSchema.validate({ NODE_ENV: 'development' });
    expect(valid.error).toBeUndefined();
    expect(valid.value.PAYMENT_PROVIDER).toBe('DISABLED');

    const invalid = envValidationSchema.validate({
      NODE_ENV: 'development',
      PAYMENT_PROVIDER: 'UNSUPPORTED_PROVIDER',
    });
    expect(invalid.error).toBeDefined();
  });

  it('should require the real mail configuration in production', () => {
    const { error } = envValidationSchema.validate(
      { NODE_ENV: 'production', MAIL_TRANSPORT: 'resend' },
      { abortEarly: false },
    );

    for (const key of [
      'RESEND_API_KEY',
      'MAIL_FROM_ADDRESS',
      'MAIL_FROM_NAME',
      'MAIL_INTERNAL_ALERT_RECIPIENT',
    ]) {
      expect(error?.details.some((detail) => detail.context?.key === key)).toBe(
        true,
      );
    }
  });

  describe('PORT', () => {
    const iisnodePipe = '\\\\.\\pipe\\iisnode-7f3a';

    it.each([3000, '3000', 65535])('accepts numeric port %p', (PORT) => {
      const { error, value } = envValidationSchema.validate({
        NODE_ENV: 'development',
        PORT,
      });

      expect(error).toBeUndefined();
      expect(value.PORT).toBe(Number(PORT));
      expect(typeof value.PORT).toBe('number');
    });

    it('accepts an IISNode named-pipe PORT unchanged', () => {
      const { error, value } = envValidationSchema.validate({
        NODE_ENV: 'development',
        PORT: iisnodePipe,
      });

      expect(error).toBeUndefined();
      expect(value.PORT).toBe(iisnodePipe);
      expect(typeof value.PORT).toBe('string');
    });

    it.each([0, -1, 65536, 'not-a-port', '/tmp/app.sock'])(
      'rejects invalid PORT %p',
      (PORT) => {
        const { error } = envValidationSchema.validate({
          NODE_ENV: 'development',
          PORT,
        });

        expect(
          error?.details.some((detail) => detail.context?.key === 'PORT'),
        ).toBe(true);
      },
    );

    it('defaults to 3000 when PORT is missing', () => {
      const { error, value } = envValidationSchema.validate({
        NODE_ENV: 'development',
      });

      expect(error).toBeUndefined();
      expect(value.PORT).toBe(3000);
    });
  });

  describe('APP_PORT', () => {
    it.each([4000, '4000'])('accepts numeric APP_PORT %p', (APP_PORT) => {
      const { error, value } = envValidationSchema.validate({
        NODE_ENV: 'development',
        APP_PORT,
      });

      expect(error).toBeUndefined();
      expect(value.APP_PORT).toBe(4000);
    });

    it('treats an empty APP_PORT as unset', () => {
      const { error, value } = envValidationSchema.validate({
        NODE_ENV: 'development',
        APP_PORT: '',
      });

      expect(error).toBeUndefined();
      expect(value.APP_PORT).toBeUndefined();
    });

    it.each([0, -1, 65536, 'not-a-port', '\\\\.\\pipe\\iisnode-7f3a'])(
      'rejects invalid APP_PORT %p',
      (APP_PORT) => {
        const { error } = envValidationSchema.validate({
          NODE_ENV: 'development',
          APP_PORT,
        });

        expect(
          error?.details.some((detail) => detail.context?.key === 'APP_PORT'),
        ).toBe(true);
      },
    );
  });

  it('reports every missing production secret with strict validation', () => {
    const { error } = envValidationSchema.validate(
      { NODE_ENV: 'production' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();

    for (const key of [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'GUEST_TOKEN_SECRET',
      'PII_ENCRYPTION_KEY',
      'RESEND_API_KEY',
      'MAIL_FROM_ADDRESS',
      'MAIL_FROM_NAME',
      'MAIL_INTERNAL_ALERT_RECIPIENT',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ]) {
      expect(error?.details.some((detail) => detail.context?.key === key)).toBe(
        true,
      );
    }
  });
});
