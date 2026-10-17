process.env.GUEST_TOKEN_SECRET =
  process.env.GUEST_TOKEN_SECRET ||
  'test-guest-secret-48-chars-long-valid-entropy-key-123456789';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  'test-jwt-secret-48-chars-long-valid-entropy-key-123456789';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

interface PromoResponseBody {
  code: string;
  discountPercent: number;
}

interface CurrencyRatesResponseBody {
  base: string;
  rates: Record<string, string>;
}

interface ConvertResponseBody {
  originalAmount: string;
  from: string;
  to: string;
  convertedAmount: string;
}

interface IngestResponseBody {
  success: boolean;
}

describe('Promotions & Currency Engine (HTTP Contracts)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;

  const mockPromo = {
    id: 'promo-1',
    code: 'SUMMER2026',
    discountPercent: 15,
    validFrom: new Date(Date.now() - 86400000),
    validUntil: new Date(Date.now() + 86400000 * 30),
    maxUses: 100,
    currentUses: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCurrencyRates = [
    {
      id: 'curr-1',
      code: 'EUR',
      rateToBase: 0.92,
      lastUpdated: new Date(),
      provider: 'ADMIN_MANUAL',
    },
    {
      id: 'curr-2',
      code: 'EGP',
      rateToBase: 47.5,
      lastUpdated: new Date(),
      provider: 'ADMIN_MANUAL',
    },
  ];

  const prismaMock = {
    promotion: {
      findUnique: jest.fn().mockResolvedValue(mockPromo),
      findFirst: jest.fn().mockResolvedValue(mockPromo),
      findMany: jest.fn().mockResolvedValue([mockPromo]),
      create: jest.fn().mockResolvedValue(mockPromo),
      update: jest.fn().mockResolvedValue(mockPromo),
      delete: jest.fn().mockResolvedValue(mockPromo),
    },
    currencyRate: {
      findMany: jest.fn().mockResolvedValue(mockCurrencyRates),
      upsert: jest.fn().mockResolvedValue(mockCurrencyRates[0]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE',
        sessionVersion: 1,
        isVerified: true,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.SUPER_ADMIN,
        status: 'ACTIVE',
        sessionVersion: 1,
        isVerified: true,
      }),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    adminToken = jwtService.sign({
      sub: 'admin-uuid-1',
      email: 'admin@dunastravel.com',
      role: UserRole.SUPER_ADMIN,
      sv: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/promotions/validate', () => {
    it('should validate normalized promotion code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/promotions/validate')
        .send({ promoCode: 'summer2026 ' })
        .expect(200);

      const body =
        (res.body as { data?: PromoResponseBody }).data ??
        (res.body as PromoResponseBody);
      expect(body.code).toBe('SUMMER2026');
      expect(Number(body.discountPercent)).toBe(15);
    });

    it('should reject invalid promotion code', async () => {
      prismaMock.promotion.findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .post('/api/promotions/validate')
        .send({ promoCode: 'INVALID' })
        .expect(400);
    });
  });

  describe('GET /api/currency/rates', () => {
    it('should return global exchange rates with base USD', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/currency/rates')
        .expect(200);

      const body =
        (res.body as { data?: CurrencyRatesResponseBody }).data ??
        (res.body as CurrencyRatesResponseBody);
      expect(body.base).toBe('USD');
      expect(body.rates['EUR']).toBeDefined();
    });
  });

  describe('GET /api/currency/convert', () => {
    it('should convert amount between supported currencies using Decimal precision', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/currency/convert?amount=100&from=USD&to=EUR')
        .expect(200);

      const body =
        (res.body as { data?: ConvertResponseBody }).data ??
        (res.body as ConvertResponseBody);
      expect(body.from).toBe('USD');
      expect(body.to).toBe('EUR');
      expect(body.originalAmount).toBe('100.00');
    });
  });

  describe('POST /api/admin/currencies/rates', () => {
    it('should allow admin to ingest rates for supported ISO allowlist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/currencies/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rates: [{ code: 'EUR', rateToBase: 0.93, provider: 'TEST_INGEST' }],
        })
        .expect(201);

      const body =
        (res.body as { data?: IngestResponseBody }).data ??
        (res.body as IngestResponseBody);
      expect(body.success).toBe(true);
    });

    it('should reject unsupported currency code in admin ingestion', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/currencies/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rates: [{ code: 'XYZ', rateToBase: 1.5, provider: 'TEST_INGEST' }],
        })
        .expect(400);
    });
  });
});
