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
            refundPayment: jest.fn(),
            getPaymentStatus: jest.fn(),
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
    it('should return sessionUrl, url, and transactionId on valid initiate request', async () => {
      initiatePaymentMock.mockResolvedValue({
        url: 'https://checkout.stripe.com/test-session',
        transactionId: 'cs_test_123',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/payments/initiate')
        .send({ bookingId: 'b6fcd766-2cca-4c11-94b1-bc6051bf820c' });

      expect(response.status).toBe(201);
      const resBody = response.body as { data: Record<string, string> };
      expect(resBody.data).toEqual({
        sessionUrl: 'https://checkout.stripe.com/test-session',
        url: 'https://checkout.stripe.com/test-session',
        transactionId: 'cs_test_123',
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

  describe('POST /api/payments/webhook/:provider', () => {
    it('should reject unsupported provider with 400', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/payments/webhook/paypal')
        .send({});

      expect(response.status).toBe(400);
      const resBody = response.body as { message: string };
      expect(resBody.message).toContain('Unsupported payment provider');
    });
  });
});
