import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AnalyticsModule } from './analytics.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Analytics HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockEvent = {
    id: 'evt-1',
    eventId: 'evt-uuid-123',
    eventName: 'page_view',
    sessionId: 'sess-1',
    userId: null,
    interfaceSlug: null,
    tourSlug: 'classic-cairo',
    bookingRef: null,
    locale: 'en',
    pathname: '/tours/classic-cairo',
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    deviceCategory: 'desktop',
    properties: {},
    occurredAt: new Date('2026-01-01'),
    receivedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AnalyticsModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        analyticsEvent: {
          create: jest.fn().mockResolvedValue(mockEvent),
          count: jest.fn().mockResolvedValue(10),
          findMany: jest.fn().mockResolvedValue([mockEvent]),
          groupBy: jest
            .fn()
            .mockResolvedValue([
              { tourSlug: 'classic-cairo', _count: { tourSlug: 5 } },
            ]),
        },
        booking: {
          count: jest.fn().mockResolvedValue(2),
          aggregate: jest
            .fn()
            .mockResolvedValue({ _sum: { totalAmountUsd: 1500 } }),
        },
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(
      new ResponseTransformInterceptor(app.get(Reflector)),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/analytics/events tracks visitor event', async () => {
    const res = await request(app.getHttpServer())
      .post('/analytics/events')
      .send({
        eventId: 'evt-uuid-123',
        eventName: 'page_view',
        pathname: '/tours/classic-cairo',
      })
      .expect(201);

    const body = res.body.data || res.body;
    expect(body.success).toBe(true);
  });

  it('POST /api/analytics/events rejects server-only events from browser client', async () => {
    await request(app.getHttpServer())
      .post('/analytics/events')
      .send({
        eventId: 'evt-uuid-999',
        eventName: 'payment_succeeded',
      })
      .expect(400);
  });

  it('GET /api/admin/analytics/summary returns admin metrics summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/analytics/summary')
      .expect(200);

    const body = res.body.data || res.body;
    expect(body.totalEvents).toBe(10);
    expect(body.totalRevenueUsd).toBe(1500);
  });
});
