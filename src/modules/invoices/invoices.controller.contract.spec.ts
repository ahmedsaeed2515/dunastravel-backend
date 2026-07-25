import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

describe('Invoices HTTP API Contract (Supertest)', () => {
  let app: INestApplication;
  let invoicesServiceMock: jest.Mocked<Partial<InvoicesService>>;

  const mockInvoiceResponse = {
    invoiceNumber: 'INV-2026-0001',
    bookingId: 'bkg-123',
    issuedAt: '2026-07-25T00:00:00.000Z',
    status: 'SENT',
    subtotal: '3700.00',
    tax: '0.00',
    total: '3700.00',
    totalAmountUsd: '3700.00',
    currency: 'USD',
    tourTitle: 'Nile Cruise',
    tourSlug: 'nile-cruise',
    arrivalDate: '2026-09-01',
    departureDate: null,
    adults: 2,
    children: 0,
    infants: 0,
    snapshot: { baseSubtotal: '3700.00' },
    billing: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      invoiceType: 'PERSONAL',
    },
  };

  beforeAll(async () => {
    invoicesServiceMock = {
      findByInvoiceNumber: jest
        .fn()
        .mockImplementation(
          (invNum: string, userId?: string, token?: string) => {
            if (token === 'valid-guest-token' || userId === 'usr-1') {
              return Promise.resolve(mockInvoiceResponse);
            }
            if (invNum === 'INV-NOT-FOUND') {
              throw new NotFoundException('Invoice not found');
            }
            throw new UnauthorizedException(
              'You do not have permission to view this invoice',
            );
          },
        ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: invoicesServiceMock,
        },
      ],
    })
      .overrideGuard(OptionalJwtAuthGuard)
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

  describe('GET /api/invoices/:invoiceNumber', () => {
    it('returns 200 OK with immutable snapshot for valid x-guest-token header', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/invoices/INV-2026-0001')
        .set('x-guest-token', 'valid-guest-token')
        .expect(200);

      const body = res.body as ApiResponse<typeof mockInvoiceResponse>;
      expect(body.success).toBe(true);
      expect(body.data?.invoiceNumber).toBe('INV-2026-0001');
      expect(invoicesServiceMock.findByInvoiceNumber).toHaveBeenCalledWith(
        'INV-2026-0001',
        undefined,
        'valid-guest-token',
      );
    });

    it('returns 401 Unauthorized when no x-guest-token or valid JWT is presented', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/invoices/INV-2026-0001')
        .expect(401);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });
  });
});
