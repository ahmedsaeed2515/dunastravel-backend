import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tourId: string;
  let createdRefCode: string;
  let adminCookie: string;
  let csrfCookie: string;
  let csrfToken: string;

  const adminUser = {
    name: 'E2E Admin',
    email: `e2e-admin-booking-${Date.now()}@test.com`,
    password: 'Str0ng#Adm2026!',
  };

  const createBookingPayload = () => ({
    type: 'booking' as const,
    tourId,
    arrivalDate: '2027-03-15',
    adults: 2,
    children: 1,
    infants: 0,
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    invoiceType: 'PERSONAL',
    language: 'en',
    passengerNames: {
      adult_0: 'John Doe',
      adult_1: 'Jane Doe',
      child_0: 'Baby Doe',
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Create a test tour
    const tour = await prisma.tour.create({
      data: {
        slug: `e2e-tour-${Date.now()}`,
        titleJsonb: { en: 'E2E Test Tour', ar: '���� �������' },
        basePriceUsd: 199.99,
        status: 'PUBLISHED',
        isActive: true,
      },
    });
    tourId = tour.id;

    // Create and verify admin user
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(adminUser);

    await prisma.user.update({
      where: { email: adminUser.email },
      data: { isVerified: true, role: 'ADMIN' },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });

    adminCookie =
      (loginRes.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('access_token='),
      ) ?? '';

    // Fetch CSRF token for guest endpoints
    const csrfRes = await request(app.getHttpServer()).get('/api/auth/csrf');
    const csrfCookies = csrfRes.headers['set-cookie'] as unknown as string[];
    csrfCookie =
      csrfCookies
        ?.find((c: string) => c.startsWith('csrf_token='))
        ?.split(';')[0] ?? '';
    csrfToken =
      csrfRes.body?.data?.csrfToken ||
      csrfRes.body?.csrfToken ||
      csrfCookie.replace('csrf_token=', '');
  });

  afterAll(async () => {
    try {
      if (createdRefCode) {
        const bkg = await prisma.booking.findFirst({
          where: { referenceCode: createdRefCode },
        });
        if (bkg) {
          await prisma.bookingActivityLog
            .deleteMany({ where: { bookingId: bkg.id } })
            .catch(() => {});
          await prisma.payment
            .deleteMany({ where: { bookingId: bkg.id } })
            .catch(() => {});
          await prisma.invoice
            .deleteMany({ where: { bookingId: bkg.id } })
            .catch(() => {});
          await prisma.billingInfo
            .deleteMany({ where: { bookingId: bkg.id } })
            .catch(() => {});
          await prisma.passenger
            .deleteMany({ where: { bookingId: bkg.id } })
            .catch(() => {});
          await prisma.booking
            .deleteMany({ where: { id: bkg.id } })
            .catch(() => {});
        }
      }
      if (tourId) {
        await prisma.tour.deleteMany({ where: { id: tourId } }).catch(() => {});
      }
      if (adminUser.email) {
        await prisma.user
          .deleteMany({ where: { email: adminUser.email } })
          .catch(() => {});
      }
    } finally {
      await app?.close();
      await prisma?.$disconnect();
    }
  });

  describe('POST /api/bookings', () => {
    it('should create a booking as authenticated user and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', `${adminCookie}; ${csrfCookie}`)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', `bkg_e2e_1_${Date.now()}`)
        .send(createBookingPayload())
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.referenceCode).toMatch(/^BKG-[A-Z0-9]{6}$/);
      expect(res.body.data.invoiceNumber).toMatch(/^INV-\d{4}-\d+$/);
      expect(res.body.data.adults).toBe(2);
      expect(res.body.data.children).toBe(1);

      createdRefCode = res.body.data.referenceCode;
    });

    it('should reject invalid tourId with 422', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', `${adminCookie}; ${csrfCookie}`)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', `bkg_e2e_2_${Date.now()}`)
        .send({
          ...createBookingPayload(),
          tourId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(422);
    });

    it('should reject adults=0 with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', `${adminCookie}; ${csrfCookie}`)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', `bkg_e2e_3_${Date.now()}`)
        .send({ ...createBookingPayload(), adults: 0 })
        .expect(400);
    });

    it('should require companyName when invoiceType=COMPANY', async () => {
      const payload: any = {
        ...createBookingPayload(),
        invoiceType: 'COMPANY',
      };
      delete payload.companyName;
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', `${adminCookie}; ${csrfCookie}`)
        .set('x-csrf-token', csrfToken)
        .set('idempotency-key', `bkg_e2e_4_${Date.now()}`)
        .send(payload)
        .expect(400);
    });
  });

  describe('GET /api/bookings/:referenceCode', () => {
    it('should retrieve booking by refCode when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.referenceCode).toBe(createdRefCode);
      expect(res.body.data.adults).toBe(2);
    });

    it('should return 404 when no email or auth provided (IDOR protection)', async () => {
      await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}`)
        .expect(404);
    });

    it('should return 400 for invalid referenceCode format', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/INVALID-BOOKING-REFERENCE-CODE-THAT-IS-TOO-LONG')
        .expect(400);
    });

    it('should return 404 for non-existent referenceCode', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/BKG-ZZZZZZ')
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });

  describe('GET /api/invoices/:invoiceNumber', () => {
    it('should retrieve invoice details', async () => {
      // Get invoice number from booking
      const bookingRes = await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}`)
        .set('Cookie', adminCookie);
      const invoiceNumber = bookingRes.body.data.invoiceNumber;

      const res = await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceNumber}`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.invoiceNumber).toBe(invoiceNumber);
    });

    it('should return 400 for invalid invoiceNumber format', async () => {
      await request(app.getHttpServer())
        .get('/api/invoices/INVALID-NUMBER')
        .expect(400);
    });
  });

  describe('GET /api/bookings/me', () => {
    it('should return 401 Unauthorized when no valid token is provided, verifying isolated scoping', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .get('/api/bookings/me')
        .expect(401);

      // Assert
      expect(res.body.statusCode).toBe(401);
      expect(res.body.message).toBe('Unauthorized');
    });

    it('should return user bookings when properly authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bookings/me')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
