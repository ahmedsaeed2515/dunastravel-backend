import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { NotificationsModule } from './notifications.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';

import { ConfigModule } from '@nestjs/config';

describe('Notifications HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockDeliveryLog = {
    id: 'notif-1',
    notificationType: 'CUSTOMER_ACKNOWLEDGMENT',
    originReferenceCode: 'INQ-100',
    originEntityType: 'INQUIRY',
    recipientEmail: 'customer@example.com',
    status: 'FAILED',
    attempts: 3,
    lastAttemptAt: new Date('2026-01-01'),
    failureReason: 'Provider timeout',
    providerResponseId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockInquiry = {
    id: 'inq-1',
    referenceCode: 'INQ-100',
    fullName: 'Jane Doe',
    email: 'customer@example.com',
    phone: '+123456789',
    preferredLanguage: 'en',
    destinations: ['Cairo'],
    adults: 2,
    children: 0,
    status: 'NEWLY_RECEIVED',
    createdAt: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), NotificationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        notificationDeliveryLog: {
          findMany: jest.fn().mockResolvedValue([mockDeliveryLog]),
          count: jest.fn().mockResolvedValue(1),
          findUnique: jest.fn().mockResolvedValue(mockDeliveryLog),
          update: jest.fn().mockResolvedValue({
            ...mockDeliveryLog,
            status: 'SENT',
          }),
          create: jest.fn().mockResolvedValue(mockDeliveryLog),
        },
        emailTemplate: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        tailorMadeInquiry: {
          findUnique: jest.fn().mockResolvedValue(mockInquiry),
        },
      })
      .overrideProvider(EMAIL_PROVIDER_TOKEN)
      .useValue({
        send: jest.fn().mockResolvedValue({
          status: 'SUCCESS',
          providerMessageId: 'msg-123',
        }),
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

  it('GET /api/admin/communications/logs returns admin delivery logs', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/communications/logs')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items[0].id).toBe('notif-1');
  });

  it('GET /api/admin/communications/logs/metrics returns delivery metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/communications/logs/metrics')
      .expect(200);

    const body = res.body.data || res.body;
    expect(body.totalFailed).toBeDefined();
  });

  it('POST /api/admin/communications/logs/:id/retry triggers manual retry', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/communications/logs/notif-1/retry')
      .expect(201);

    const body = res.body.data || res.body;
    expect(body.success).toBe(true);
  });
});
