import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

describe('Phase 1 Concurrency & Data Integrity (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testTourSlug = 'cairo-express-4d';
  let testTourId: string;
  let testSlotId: string;
  const testDateStr = '2027-11-20';
  const createdBookingIds: string[] = [];

  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    prisma = app.get(PrismaService);

    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    // Authenticate test user
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'traveler.test@dunastravel.com',
        password: 'Password123!',
      });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
    const accessTokenCookie = cookies?.find((c) => c.startsWith('access_token='));
    accessToken = accessTokenCookie!.split(';')[0].replace('access_token=', '');

    // Find Cairo Express tour
    const tour = await prisma.tour.findUnique({ where: { slug: testTourSlug } });
    if (!tour) throw new Error('Cairo Express tour not found');
    testTourId = tour.id;

    // Create/upsert a dedicated isolated test slot with exactly 1 seat
    const slot = await prisma.tourAvailability.upsert({
      where: {
        tourId_date: {
          tourId: testTourId,
          date: new Date(`${testDateStr}T00:00:00.000Z`),
        },
      },
      update: {
        totalCapacity: 1,
        remainingSeats: 1,
        status: 'AVAILABLE',
      },
      create: {
        tourId: testTourId,
        date: new Date(`${testDateStr}T00:00:00.000Z`),
        totalCapacity: 1,
        remainingSeats: 1,
        status: 'AVAILABLE',
      },
    });
    testSlotId = slot.id;
  }, 120000);

  afterAll(async () => {
    // Clean up created bookings
    for (const bkgId of createdBookingIds) {
      await prisma.bookingActivityLog.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.invoice.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.billingInfo.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.passenger.deleteMany({ where: { bookingId: bkgId } }).catch(() => {});
      await prisma.booking.deleteMany({ where: { id: bkgId } }).catch(() => {});
    }

    if (testSlotId) {
      await prisma.tourAvailability.delete({ where: { id: testSlotId } }).catch(() => {});
    }

    await app.close();
    await prisma.$disconnect();
  }, 60000);

  it('Scenario 1: Tours have unlimited capacity (multiple concurrent registrants succeed) & closed dates reject', async () => {
    // 1. Multiple distinct concurrent bookings for the same date must all succeed
    const N = 3;
    const requests = Array.from({ length: N }, (_, i) => {
      const idempotencyKey = `unlimited_bkg_${Date.now()}_${i}`;
      return request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('idempotency-key', idempotencyKey)
        .send({
          type: 'booking',
          tourId: testTourSlug,
          availabilityId: testSlotId,
          arrivalDate: testDateStr,
          adults: 1,
          children: 0,
          fullName: `Concurrency Tester ${i}`,
          email: `tester${i}@dunastravel.com`,
          phone: `+20100000000${i}`,
          language: 'en',
        });
    });

    const responses = await Promise.all(requests);
    console.log('MUTATION 1 DEBUG RESPONSES:', responses.map((r) => ({ status: r.status, body: r.body })));
    const successful = responses.filter((r) => r.status === 201);
    expect(successful.length).toBe(N);

    for (const res of successful) {
      const bkgData = res.body?.data !== undefined ? res.body.data : res.body;
      createdBookingIds.push(bkgData.id);
    }

    // 2. An explicitly CLOSED departure must be rejected
    await prisma.tourAvailability.update({
      where: { id: testSlotId },
      data: { status: 'CLOSED' },
    });

    const closedRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', `closed_test_${Date.now()}`)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDateStr,
        adults: 1,
        children: 0,
        fullName: 'Closed Tester',
        email: 'closed@dunastravel.com',
        phone: '+201000000099',
        language: 'en',
      });

    expect(closedRes.status).toBe(422);
    const msg = closedRes.body?.message || '';
    expect(msg.toLowerCase()).toContain('closed');

    // Restore to AVAILABLE for subsequent tests
    await prisma.tourAvailability.update({
      where: { id: testSlotId },
      data: { status: 'AVAILABLE' },
    });
  });

  it('Scenario 2: Concurrent duplicate requests with the SAME idempotency-key -> Only 1 booking created', async () => {
    // Reset slot to 5 seats
    await prisma.tourAvailability.update({
      where: { id: testSlotId },
      data: { totalCapacity: 5, remainingSeats: 5, status: 'AVAILABLE' },
    });

    const sharedKey = `shared_key_${Date.now()}`;
    const payload = {
      type: 'booking',
      tourId: testTourSlug,
      availabilityId: testSlotId,
      arrivalDate: testDateStr,
      adults: 1,
      children: 0,
      fullName: 'Idempotency Tester',
      email: 'idempotent@dunastravel.com',
      phone: '+201000009999',
      language: 'en',
    };

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('idempotency-key', sharedKey)
        .send(payload),
      request(app.getHttpServer())
        .post('/api/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('idempotency-key', sharedKey)
        .send(payload),
    ]);

    expect([200, 201]).toContain(res1.status);
    expect([200, 201]).toContain(res2.status);

    const data1 = res1.body?.data || res1.body;
    const data2 = res2.body?.data || res2.body;

    expect(data1.referenceCode).toBe(data2.referenceCode);
    expect(data1.id).toBe(data2.id);

    createdBookingIds.push(data1.id);

    // Confirm strictly 1 booking row exists in DB with this idempotency key
    const rows = await prisma.booking.findMany({
      where: { idempotencyKey: sharedKey },
    });
    expect(rows.length).toBe(1);
  });
});
