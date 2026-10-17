import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let userCookie: string;
  let testTourId: string;
  let testBookingRef: string;
  const csrfToken = 'dummy_csrf_token_for_testing_123456';

  const adminCredentials = {
    name: 'E2E Admin User',
    email: `e2e-admin-${Date.now()}@test.com`,
    password: 'Str0ng#Adm2026!',
  };

  const regularUser = {
    name: 'E2E Regular User',
    email: `e2e-user-${Date.now()}@test.com`,
    password: 'Str0ng#Usr2026!',
  };

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

    // Create test tour
    const tour = await prisma.tour.create({
      data: {
        slug: `e2e-admin-tour-${Date.now()}`,
        titleJsonb: { en: 'Admin E2E Tour' },
        basePriceUsd: 199.99,
        status: 'PUBLISHED',
        isActive: true,
      },
    });
    testTourId = tour.id;

    await prisma.tourAvailability.upsert({
      where: {
        tourId_date: {
          tourId: testTourId,
          date: new Date('2028-06-01T00:00:00.000Z'),
        },
      },
      update: {
        totalCapacity: 50,
        remainingSeats: 50,
        status: 'AVAILABLE',
      },
      create: {
        tourId: testTourId,
        date: new Date('2028-06-01T00:00:00.000Z'),
        totalCapacity: 50,
        remainingSeats: 50,
        status: 'AVAILABLE',
      },
    });

    // Setup admin user
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(adminCredentials);
    await prisma.user.update({
      where: { email: adminCredentials.email },
      data: { isVerified: true, role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: adminCredentials.email,
        password: adminCredentials.password,
      });
    adminCookie =
      (adminLogin.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('access_token='),
      ) ?? '';
    adminCookie = `${adminCookie}; csrf_token=${csrfToken}`;

    // Setup regular user
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(regularUser);
    await prisma.user.update({
      where: { email: regularUser.email },
      data: { isVerified: true },
    });
    const userLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: regularUser.email, password: regularUser.password });
    userCookie =
      (userLogin.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('access_token='),
      ) ?? '';
    userCookie = `${userCookie}; csrf_token=${csrfToken}`;

    // Create a test booking
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Cookie', userCookie)
      .set('x-csrf-token', csrfToken)
      .set('idempotency-key', `bkg_admin_e2e_${Date.now()}`)
      .send({
        tourId: testTourId,
        arrivalDate: '2028-06-01',
        adults: 2,
        children: 0,
        infants: 0,
        type: 'booking',
        fullName: 'Admin E2E Passenger',
        email: 'admin-e2e@booking.com',
        phone: '+1234567890',
        passengerNames: {
          adult_0: 'Admin E2E Passenger',
          adult_1: 'Second Passenger',
        },
        invoiceType: 'PERSONAL',
      });
    testBookingRef = bookingRes.body.data?.referenceCode;
  });

  afterAll(async () => {
    try {
      if (testBookingRef) {
        const bkg = await prisma.booking.findFirst({
          where: { referenceCode: testBookingRef },
        });
        if (bkg) {
          await prisma.bookingActivityLog
            .deleteMany({
              where: { bookingId: bkg.id },
            })
            .catch(() => {});
          await prisma.payment
            .deleteMany({
              where: { bookingId: bkg.id },
            })
            .catch(() => {});
          await prisma.invoice
            .deleteMany({
              where: { bookingId: bkg.id },
            })
            .catch(() => {});
          await prisma.billingInfo
            .deleteMany({
              where: { bookingId: bkg.id },
            })
            .catch(() => {});
          await prisma.passenger
            .deleteMany({
              where: { bookingId: bkg.id },
            })
            .catch(() => {});
          await prisma.booking
            .deleteMany({
              where: { id: bkg.id },
            })
            .catch(() => {});
        }
      }
      await prisma.tourAvailability
        .deleteMany({
          where: { tourId: testTourId },
        })
        .catch(() => {});
      await prisma.tour
        .deleteMany({
          where: { id: testTourId },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: { email: { in: [adminCredentials.email, regularUser.email] } },
        })
        .catch(() => {});
    } catch {
      // ignore
    }
    await app.close();
  });

  // ??? Authorization Barriers ??????????????????????????????????

  describe('Access Control', () => {
    it('should block unauthenticated access to admin endpoints with 401', async () => {
      await request(app.getHttpServer()).get('/api/admin/bookings').expect(401);
    });

    it('should block regular USER from admin endpoints with 403', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/bookings')
        .set('Cookie', userCookie)
        .expect(403);
    });
  });

  // ??? Dashboard ???????????????????????????????????????????????

  describe('GET /api/admin/dashboard', () => {
    it('should return dashboard metrics for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalBookings');
      expect(res.body.data).toHaveProperty('bookingsThisMonth');
      expect(res.body.data).toHaveProperty('totalInquiries');
    });
  });

  // ??? Bookings Management ?????????????????????????????????????

  describe('GET /api/admin/bookings', () => {
    it('should return paginated bookings list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/bookings?page=1&limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('should filter by status=PENDING', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/bookings?status=PENDING')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.every((b: any) => b.status === 'PENDING')).toBe(
        true,
      );
    });
  });

  describe('GET /api/admin/bookings/:referenceCode', () => {
    it('should return full booking detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/bookings/${testBookingRef}`)
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.referenceCode).toBe(testBookingRef);
      expect(res.body.data).toHaveProperty('passengers');
      expect(res.body.data).toHaveProperty('billingInfo');
    });

    it('should return 404 for non-existent reference', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/bookings/BKG-ZZZZZZ')
        .set('Cookie', adminCookie)
        .expect(404);
    });
  });

  describe('PATCH /api/admin/bookings/:referenceCode/status', () => {
    it('should update booking status to CONFIRMED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/admin/bookings/${testBookingRef}/status`)
        .set('Cookie', adminCookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('should reject invalid status value with 400', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/bookings/${testBookingRef}/status`)
        .set('Cookie', adminCookie)
        .set('x-csrf-token', csrfToken)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  // ??? Negative / Edge Cases ???????????????????????????????????

  describe('Edge Cases', () => {
    it('should return empty array for page beyond total', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/bookings?page=9999&limit=10')
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('should reject limit > 100 with 400', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/bookings?limit=999')
        .set('Cookie', adminCookie)
        .expect(400);
    });
  });
});
