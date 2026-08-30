import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../common/guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';

describe('PaymentsController (HTTP Contract)', () => {
  let app: INestApplication;
  let initiatePaymentMock: jest.Mock;

  beforeAll(async () => {
    initiatePaymentMock = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            initiatePayment: initiatePaymentMock,
            handleWebhook: jest.fn(),
            reconcilePayLinkCallback: jest.fn(),
            refundPayment: jest.fn(),
            getPaymentStatus: jest.fn(),
            getReadiness: jest.fn().mockReturnValue({
              provider: 'DISABLED',
              enabled: false,
              configured: false,
              mode: 'disabled',
              supportedCurrencies: [],
              missingConfiguration: ['PAYMENT_PROVIDER'],
            }),
          },
        },
      ],
    })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
          req.user = { id: 'usr-123', role: 'USER' };
          return true;
        },
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
          req.user = { id: 'usr-admin', role: 'ADMIN' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/initiate', () => {
    it('should return sessionUrl, URL, provider transaction and internal payment IDs', async () => {
      initiatePaymentMock.mockResolvedValue({
        url: 'https://hosted.getpayin.example/test-session',
        providerInvoiceId: '40506',
        paymentId: '1b75ef8c-5b72-4f8a-a9cb-03c7403282d5',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/payments/initiate')
        .send({ bookingId: 'b6fcd766-2cca-4c11-94b1-bc6051bf820c' });

      expect(response.status).toBe(201);
      const resBody = response.body as { data: Record<string, string> };
      expect(resBody.data).toMatchObject({
        sessionUrl: 'https://hosted.getpayin.example/test-session',
        url: 'https://hosted.getpayin.example/test-session',
        transactionId: '40506',
        paymentId: '1b75ef8c-5b72-4f8a-a9cb-03c7403282d5',
      });
    });

    it('should reject invalid non-UUID bookingId with 400', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/payments/initiate')
        .send({ bookingId: 'invalid-id' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/payments/readiness', () => {
    it('returns only public non-secret provider readiness', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/payments/readiness');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        provider: 'DISABLED',
        enabled: false,
        configured: false,
        mode: 'disabled',
        supportedCurrencies: [],
        missingConfiguration: ['PAYMENT_PROVIDER'],
      });
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(JSON.stringify(response.body)).not.toContain('apiKey');
    });
  });

  describe('POST /api/payments/webhook/:provider', () => {
    it('should process webhook for valid provider', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/payments/webhook/getpayin')
        .send({ eventId: 'evt_1', status: 'COMPLETED' });

      expect(response.status).toBe(200);
    });
  });
});
