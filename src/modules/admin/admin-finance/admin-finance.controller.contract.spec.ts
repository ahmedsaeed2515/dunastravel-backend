import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { JwtAuthGuard, RolesGuard } from '../../../common/guards';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';

describe('AdminFinanceController (HTTP Contract)', () => {
  let app: INestApplication;
  let listPaymentsMock: jest.Mock;
  let processRefundMock: jest.Mock;

  beforeAll(async () => {
    listPaymentsMock = jest.fn();
    processRefundMock = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminFinanceController],
      providers: [
        {
          provide: AdminFinanceService,
          useValue: {
            listPayments: listPaymentsMock,
            getPaymentDetail: jest.fn(),
            processRefund: processRefundMock,
          },
        },
      ],
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

    app = moduleRef.createNestApplication();
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

  describe('GET /api/admin/finance/payments', () => {
    it('should return paginated payments list', async () => {
      listPaymentsMock.mockResolvedValue({
        data: [
          {
            id: 'pmt-1',
            bookingId: 'bkg-1',
            bookingReferenceCode: 'REF-1',
            amount: '100.00',
            currency: 'USD',
            status: 'CAPTURED',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/admin/finance/payments?page=1&limit=10');

      expect(response.status).toBe(200);
      const resBody = response.body as { data: Array<{ amount: string }> };
      expect(resBody.data.length).toBe(1);
      expect(resBody.data[0].amount).toBe('100.00');
    });

    it('should reject invalid sorting field with 400', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/admin/finance/payments?sortBy=invalidField');

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/finance/refunds', () => {
    it('should process full refund request', async () => {
      processRefundMock.mockResolvedValue({
        success: true,
        refundId: 'rf_123',
        status: 'REFUNDED',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/admin/finance/refunds')
        .send({
          paymentId: 'pmt-123',
          amount: 100,
          reason: 'Customer requested cancellation',
        });

      expect(response.status).toBe(201);
      const body = response.body as Record<string, unknown>;
      const resData = body.data || body;
      expect(resData).toEqual({
        success: true,
        refundId: 'rf_123',
        status: 'REFUNDED',
      });
    });
  });
});
