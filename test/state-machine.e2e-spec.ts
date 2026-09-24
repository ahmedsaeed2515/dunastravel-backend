import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaylinkClient } from '@getpayin/paylink';
import { AvailabilityService } from '../src/modules/availability/availability.service';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

jest.setTimeout(120000);

describe('Phase 4 State Machine Completeness (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let availabilityService: AvailabilityService;
  let fetchSpy: jest.SpyInstance;
  let paylinkClient: PaylinkClient;

  const testUserEmail = 'traveler.test@dunastravel.com';
  const testUserPassword = 'Password123!';
  const testTourSlug = 'cairo-express-4d';
  const testSlotId = '70e66fa4-05bc-41e8-a7d3-77a4c09d6b92';
  const testDate = '2026-09-14';

  let hashToken: string;
  let accessToken: string;

  beforeAll(async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);

      if (urlStr.includes('/api/v2/integration/init')) {
        const freshInvoiceId = Math.floor(400000 + Math.random() * 500000);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              checkout_url: `https://pay.getpayin.com/integration/checkout?invoice_id=${freshInvoiceId}`,
              invoice_id: freshInvoiceId,
              expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    prisma = app.get(PrismaService);
    availabilityService = app.get(AvailabilityService);

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

    const configService = app.get(ConfigService);
    hashToken = configService.get('GETPAYIN_HASH_TOKEN') || 'sandbox_hash_token_dunas_secret_2026';

    paylinkClient = new PaylinkClient({
      publicToken: 'dummy',
      hashToken: hashToken,
    });

    // Reset availability slot
    await prisma.tourAvailability.update({
      where: { id: testSlotId },
      data: { totalCapacity: 50, remainingSeats: 50, status: 'AVAILABLE' },
    });

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: testUserPassword });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
    const accessTokenCookie = cookies?.find((c) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();
    accessToken = accessTokenCookie!.split(';')[0].replace('access_token=', '');
  });

  afterAll(async () => {
    fetchSpy?.mockRestore();
    await app?.close();
  });

  it('1. State Transition Matrix: strictly forbids illegal regressions (CONFIRMED -> PENDING)', async () => {
    // 1a. Create booking and confirm it
    const idempotencyKey = `sm_matrix_${Date.now()}`;
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', idempotencyKey)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        fullName: 'Matrix Tester',
        email: 'matrix@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    const bookingId = (bookingRes.body?.data || bookingRes.body).id;

    await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    const payment = await prisma.payment.findFirst({ where: { bookingId } });
    const invoiceId = Number(payment!.transactionId);

    const paidPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed',
      order_amount: 5.00,
      order_currency: 'USD',
    };
    paidPayload.signature = (paylinkClient.webhooks as any).computeSignature(paidPayload, hashToken);

    await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(paidPayload);

    const confirmedBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(confirmedBooking?.status).toBe('CONFIRMED');

    // 1b. Attempt to move CONFIRMED -> PENDING via admin/patch status is forbidden
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/admin/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'PENDING' });

    // Must be rejected (either 403 Forbidden or 409 Conflict)
    expect([400, 403, 404, 409]).toContain(patchRes.status);

    const checkBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(checkBooking?.status).toBe('CONFIRMED');
  });

  it('2. Expired Holds Sweep: releaseExpiredHolds cancels abandoned booking, voids invoice, releases seats, and blocks late webhook', async () => {
    // 2a. Record slot seats before booking
    const slotBefore = await prisma.tourAvailability.findUnique({ where: { id: testSlotId } });
    const seatsBefore = slotBefore!.remainingSeats;

    // 2b. Create a booking (reserves 2 seats)
    const idempotencyKey = `sm_sweep_${Date.now()}`;
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', idempotencyKey)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 2,
        children: 0,
        fullName: 'Sweep Tester',
        email: 'sweep@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    const bookingId = (bookingRes.body?.data || bookingRes.body).id;

    // Verify seats decremented by 2
    const slotAfterBook = await prisma.tourAvailability.findUnique({ where: { id: testSlotId } });
    expect(slotAfterBook!.remainingSeats).toBe(seatsBefore - 2);

    // Backdate booking.createdAt to simulate expired hold (> 15 minutes old)
    await prisma.booking.update({
      where: { id: bookingId },
      data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) },
    });

    // 2c. Execute availability hold release job
    const releasedCount = await availabilityService.releaseExpiredHolds(15);
    expect(releasedCount).toBeGreaterThanOrEqual(1);

    // 2d. Verify booking is CANCELLED, invoice is VOID, and seats are restored
    const sweptBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });
    expect(sweptBooking?.status).toBe('CANCELLED');
    expect(sweptBooking?.invoice?.status).toBe('VOID');

    const slotAfterSweep = await prisma.tourAvailability.findUnique({ where: { id: testSlotId } });
    expect(slotAfterSweep!.remainingSeats).toBeGreaterThanOrEqual(slotAfterBook!.remainingSeats + 2);

    // 2e. Late webhook arriving for this CANCELLED booking is strictly rejected
    const lateInvoiceId = Math.floor(900000 + Math.random() * 90000);
    const latePaidPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: lateInvoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Late payment',
      order_amount: 10.00,
      order_currency: 'USD',
    };
    latePaidPayload.signature = (paylinkClient.webhooks as any).computeSignature(latePaidPayload, hashToken);

    // Associate a dummy payment with the cancelled booking to test payment capture barrier
    await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        bookingId: bookingId,
        amount: new Prisma.Decimal(10.00),
        currency: 'USD',
        method: 'GETPAYIN',
        provider: 'GETPAYIN',
        transactionId: String(lateInvoiceId),
        providerPaymentId: String(lateInvoiceId),
        status: 'PENDING',
      },
    });

    const lateWebhookRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(latePaidPayload);

    expect(lateWebhookRes.status).toBe(422);
    expect(lateWebhookRes.body.message).toContain('Cannot capture payment for booking in terminal status CANCELLED');

    const bookingFinal = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(bookingFinal?.status).toBe('CANCELLED');

    // 2f. Active session protection: A booking older than 15m with an unexpired payment session (expiresAt > now) is NOT cancelled by the sweep
    const activeSessionBookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', `sm_active_sess_${Date.now()}`)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        fullName: 'Active Session User',
        email: 'activesession@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });
    const activeBookingId = (activeSessionBookingRes.body?.data || activeSessionBookingRes.body).id;

    // Attach an in-flight payment session expiring 30 minutes in the future
    await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        bookingId: activeBookingId,
        amount: new Prisma.Decimal(5.00),
        currency: 'USD',
        method: 'GETPAYIN',
        provider: 'GETPAYIN',
        transactionId: String(Math.floor(900000 + Math.random() * 90000)),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Backdate booking createdAt to 20 mins ago
    await prisma.booking.update({
      where: { id: activeBookingId },
      data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) },
    });

    // Run sweep again
    await availabilityService.releaseExpiredHolds(15);

    // Active session booking MUST NOT be cancelled
    const activeBookingCheck = await prisma.booking.findUnique({ where: { id: activeBookingId } });
    expect(activeBookingCheck?.status).toBe('PENDING');
  });

  it('3. Full Refund: transitions Payment to REFUNDED, Booking to REFUNDED, and releases seats', async () => {
    const slotBefore = await prisma.tourAvailability.findUnique({ where: { id: testSlotId } });
    const seatsBefore = slotBefore!.remainingSeats;

    const idempotencyKey = `sm_refund_${Date.now()}`;
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', idempotencyKey)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        fullName: 'Refund Tester',
        email: 'refund@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    const bookingId = (bookingRes.body?.data || bookingRes.body).id;

    await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    const payment = await prisma.payment.findFirst({ where: { bookingId } });
    const invoiceId = Number(payment!.transactionId);

    // Pay and confirm
    const paidPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed',
      order_amount: 5.00,
      order_currency: 'USD',
    };
    paidPayload.signature = (paylinkClient.webhooks as any).computeSignature(paidPayload, hashToken);

    await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(paidPayload);

    // Now issue full refund webhook: invoice.refunded
    const refundPayload: Record<string, any> = {
      event: 'invoice.refunded',
      invoice_id: invoiceId,
      invoice_status: 'REFUNDED',
      success: 1,
      message: 'Refunded',
    };
    refundPayload.signature = (paylinkClient.webhooks as any).computeSignature(refundPayload, hashToken);

    const refundRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(refundPayload);

    expect(refundRes.status).toBe(200);

    // Verify DB states
    const paymentAfter = await prisma.payment.findFirst({ where: { bookingId } });
    const bookingAfter = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });

    expect(paymentAfter?.status).toBe('REFUNDED');
    expect(paymentAfter?.isRefund).toBe(true);
    expect(bookingAfter?.status).toBe('REFUNDED');
    expect(Number(bookingAfter?.paidAmountUsd)).toBe(0);
    expect(bookingAfter?.invoice?.status).toBe('CREDIT_NOTE');

    // Capacity must be released back
    const slotAfterRefund = await prisma.tourAvailability.findUnique({ where: { id: testSlotId } });
    expect(slotAfterRefund!.remainingSeats).toBe(seatsBefore);
  });
});
