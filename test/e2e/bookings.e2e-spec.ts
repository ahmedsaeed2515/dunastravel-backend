import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
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
    password: 'AdminPass123!',
  };

  const createBookingPayload = () => ({
    tourId,
    arrivalDate: '2027-03-15',
    adults: 2,
    children: 1,
    infants: 0,
    passengerNames: [
      { passengerType: 'adult', fullName: 'John Doe' },
      { passengerType: 'adult', fullName: 'Jane Doe' },
      { passengerType: 'child', fullName: 'Baby Doe' },
    ],
    billing: {
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      invoiceType: 'PERSONAL',
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
    csrfCookie = csrfCookies?.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] ?? '';
    csrfToken = csrfRes.body.csrfToken;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.tour.deleteMany({ where: { id: tourId } });
    await prisma.user.deleteMany({ where: { email: adminUser.email } });
    await app.close();
  });

  describe('POST /api/bookings', () => {
    it('should create a booking as guest and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
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
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({
          ...createBookingPayload(),
          tourId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(422);
    });

    it('should reject adults=0 with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ ...createBookingPayload(), adults: 0 })
        .expect(400);
    });

    it('should require companyName when invoiceType=COMPANY', async () => {
      const payload = createBookingPayload();
      payload.billing = { ...payload.billing, invoiceType: 'COMPANY' };
      await request(app.getHttpServer())
        .post('/api/bookings')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send(payload)
        .expect(400);
    });
  });

  describe('GET /api/bookings/:referenceCode', () => {
    it('should retrieve booking by refCode + billing email', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}?email=john.doe@example.com`)
        .expect(200);

      expect(res.body.data.referenceCode).toBe(createdRefCode);
      expect(res.body.data.adults).toBe(2);
    });

    it('should return 404 when wrong email is provided (IDOR protection)', async () => {
      await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}?email=hacker@evil.com`)
        .expect(404);
    });

    it('should return 404 when no email or auth provided', async () => {
      await request(app.getHttpServer())
        .get(`/api/bookings/${createdRefCode}`)
        .expect(404);
    });

    it('should return 400 for invalid referenceCode format', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/INVALID-CODE?email=x@x.com')
        .expect(400);
    });

    it('should return 404 for non-existent referenceCode', async () => {
      await request(app.getHttpServer())
        .get('/api/bookings/BKG-ZZZZZZ?email=john.doe@example.com')
        .expect(404);
    });
  });

  describe('GET /api/invoices/:invoiceNumber', () => {
    it('should retrieve invoice details', async () => {
      // Get invoice number from booking
      const bookingRes = await request(app.getHttpServer()).get(
        `/api/bookings/${createdRefCode}?email=john.doe@example.com`,
      );
      const invoiceNumber = bookingRes.body.data.invoiceNumber;

      const res = await request(app.getHttpServer())
        .get(`/api/invoices/${invoiceNumber}`)
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
