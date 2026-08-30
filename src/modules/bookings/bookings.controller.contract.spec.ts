import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  NotFoundException,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

describe('Bookings HTTP API Contract (Supertest)', () => {
  let app: INestApplication;
  let bookingsServiceMock: jest.Mocked<Partial<BookingsService>>;

  const mockJwtAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        req.user = { id: 'usr-1', email: 'jane@example.com', role: 'USER' };
        return true;
      }
      throw new UnauthorizedException();
    }),
  };

  const mockOptionalJwtAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Bearer ')) {
        req.user = { id: 'usr-1', email: 'jane@example.com', role: 'USER' };
      }
      return true;
    }),
  };

  const mockBookingResponse = {
    id: 'bkg-123',
    referenceCode: 'BKG-A4X7Z2',
    invoiceNumber: 'INV-2026-0001',
    status: 'PENDING',
    tourTitle: 'Luxurious Nile Cruise',
    arrivalDate: '2026-09-01',
    departureDate: null,
    adults: 2,
    children: 0,
    infants: 0,
    totalAmountUsd: '3700.00',
    passengers: [{ id: 'p1', passengerType: 'ADULT', fullName: 'Jane Doe' }],
    billing: {
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      invoiceType: 'PERSONAL',
      companyName: null,
      taxId: null,
      address: null,
      city: null,
      country: null,
    },
    guestToken: null,
  };

  const mockCalculatedPriceResponse = {
    basePriceUsd: '1850.00',
    adultTotalUsd: '3700.00',
    childTotalUsd: '0.00',
    seasonalAdjustmentUsd: '0.00',
    discountAmountUsd: '0.00',
    totalAmountUsd: '3700.00',
    currency: 'USD',
    promoValid: false,
    promoMessage: null,
  };

  beforeAll(async () => {
    bookingsServiceMock = {
      calculatePrice: jest.fn().mockResolvedValue(mockCalculatedPriceResponse),
      createBooking: jest.fn().mockResolvedValue(mockBookingResponse),
      findByReferenceCode: jest
        .fn()
        .mockImplementation((ref: string, _user?: string, token?: string) => {
          if (token === 'valid-guest-token' || _user === 'usr-1') {
            return Promise.resolve({
              id: 'bkg-123',
              referenceCode: ref,
              invoiceNumber: 'INV-2026-0001',
              status: 'PENDING',
              tourTitle: 'Luxurious Nile Cruise',
              tourSlug: 'luxurious-nile-cruise',
              arrivalDate: '2026-09-01',
              departureDate: null,
              adults: 2,
              children: 0,
              infants: 0,
              totalAmountUsd: '3700.00',
              createdAt: '2026-07-25T00:00:00.000Z',
            });
          }
          throw new NotFoundException('Booking not found');
        }),
      cancelBooking: jest
        .fn()
        .mockImplementation(
          (ref: string, _user?: string, _reason?: string, token?: string) => {
            if (token === 'valid-guest-token' || _user === 'usr-1') {
              return Promise.resolve({
                message: 'Booking cancelled successfully',
              });
            }
            throw new NotFoundException('Booking not found');
          },
        ),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: bookingsServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue(mockOptionalJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/bookings/calculate', () => {
    it('returns exact P1-007 serialized contract (200 OK)', async () => {
      const payload = {
        tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        date: '2026-09-01',
        adults: 2,
        children: 0,
      };

      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings/calculate')
        .send(payload)
        .expect(200);

      const body = res.body as ApiResponse<typeof mockCalculatedPriceResponse>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockCalculatedPriceResponse);
      expect(bookingsServiceMock.calculatePrice).toHaveBeenCalledWith(
        expect.objectContaining({
          tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          date: '2026-09-01',
          adults: 2,
        }),
      );
    });
  });

  describe('POST /api/bookings', () => {
    const validPayload = {
      type: 'booking',
      tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      arrivalDate: '2026-09-01',
      adults: 2,
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+1234567890',
      language: 'en',
    };

    it('rejects unauthenticated booking creation with 401 Unauthorized (AUTH-001)', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings')
        .set('Idempotency-Key', 'idem-key-unauth')
        .send(validPayload)
        .expect(401);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });

    it('creates booking with valid DTO and JWT authentication (201 Created)', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings')
        .set('Authorization', 'Bearer valid-jwt-token')
        .set('Idempotency-Key', 'idem-key-12345')
        .send(validPayload)
        .expect(201);

      const body = res.body as ApiResponse<typeof mockBookingResponse>;
      expect(body.success).toBe(true);
      expect(body.data?.referenceCode).toBe('BKG-A4X7Z2');
      expect(bookingsServiceMock.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking',
          tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          arrivalDate: '2026-09-01',
        }),
        'usr-1',
        'idem-key-12345',
      );
    });

    it('rejects missing required DTO fields with 400 Bad Request', async () => {
      const payload = {
        type: 'booking',
      };

      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings')
        .set('Authorization', 'Bearer valid-jwt-token')
        .set('Idempotency-Key', 'idem-key-bad-dto')
        .send(payload)
        .expect(400);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });

    it('rejects non-whitelisted extra fields with 400 Bad Request (forbidNonWhitelisted)', async () => {
      const payload = {
        type: 'booking',
        tourId: 'tour-001',
        arrivalDate: '2026-09-01',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        maliciousExtraField: 'hacked',
      };

      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings')
        .set('Authorization', 'Bearer valid-jwt-token')
        .set('Idempotency-Key', 'idem-key-malicious')
        .send(payload)
        .expect(400);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/bookings/:referenceCode', () => {
    it('allows guest access via x-guest-token header (200 OK)', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/bookings/BKG-A4X7Z2')
        .set('x-guest-token', 'valid-guest-token')
        .expect(200);

      const body = res.body as ApiResponse<{ referenceCode: string }>;
      expect(body.success).toBe(true);
      expect(body.data?.referenceCode).toBe('BKG-A4X7Z2');
    });

    it('rejects guest request missing x-guest-token header with 404 Not Found', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/bookings/BKG-A4X7Z2')
        .expect(404);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:referenceCode/cancel', () => {
    it('cancels guest booking via x-guest-token header (200 OK)', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/bookings/BKG-A4X7Z2/cancel')
        .set('x-guest-token', 'valid-guest-token')
        .send({ reason: 'Change of plans' })
        .expect(200);

      const body = res.body as ApiResponse<{ message: string }>;
      expect(body.success).toBe(true);
      expect(body.data?.message).toBe('Booking cancelled successfully');
    });
  });
});
