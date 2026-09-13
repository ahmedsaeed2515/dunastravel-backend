import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import express from 'express';
import crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PaylinkClient } from '@getpayin/paylink';
import { ConfigService } from '@nestjs/config';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

jest.setTimeout(120000);

function dataOf(res: request.Response): any {
  return res.body?.data !== undefined ? res.body.data : res.body;
}

describe('GetPayIn Complete E2E Cycle (Login -> Tour Booking -> Payment -> Webhook -> Confirmation)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fetchSpy: jest.SpyInstance;

  const testUserEmail = 'traveler.test@dunastravel.com';
  const testUserPassword = 'Password123!';
  const testTourSlug = 'cairo-express-4d';
  const testTourId = '98cb34f1-ec69-4ecf-9ebc-c98d72fd66c8';
  const testSlotId = '70e66fa4-05bc-41e8-a7d3-77a4c09d6b92';
  const testDate = '2026-09-14';

  const hashToken =
    process.env.GETPAYIN_HASH_TOKEN || 'sandbox_hash_token_dunas_secret_2026';
  const mockInvoiceId = Math.floor(100000 + Math.random() * 800000);

  let accessToken: string;
  let csrfToken: string;
  let bookingId: string;
  let bookingReference: string;
  let invoiceNumber: string;
  let paymentId: string;
  let initialSeats: number;

  beforeAll(async () => {
    // Intercept outbound fetch calls from @getpayin/paylink SDK to pay.getpayin.com
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);

      if (urlStr.includes('/api/v2/integration/init')) {
        const body = JSON.parse(String(init?.body || '{}'));

        // Validate PayLink contract compliance
        expect(body.first_name).toBe('Test');
        expect(body.last_name).toBe('Traveler');
        expect(body.currency).toBe('USD');
        expect(body.order_amount).toBe('5.00');
        expect(body.signature).toBeDefined();

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              checkout_url: `https://pay.getpayin.com/integration/checkout?invoice_id=${mockInvoiceId}`,
              invoice_id: mockInvoiceId,
              expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (urlStr.includes('/api/integration/check-status')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              invoice_id: mockInvoiceId,
              paid_status: 'PAID',
              auth_code: 'AUTH-GETPAYIN-777',
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
    console.log('--- ConfigService GETPAYIN_HASH_TOKEN:', configService.get('GETPAYIN_HASH_TOKEN'));
    console.log('--- ConfigService PAYMENT_PROVIDER:', configService.get('payments.provider'));

    // Query initial seat capacity
    const slot = await prisma.tourAvailability.findUnique({
      where: { id: testSlotId },
    });
    expect(slot).toBeDefined();
    initialSeats = slot?.remainingSeats ?? 30;
  }, 120000);

  afterAll(async () => {
    fetchSpy.mockRestore();

    // Clean up created booking and payment records
    if (bookingId) {
      const events = await prisma.processedWebhookEvent.findMany({
        where: { payload: { path: ['bookingId'], equals: bookingId } },
        select: { id: true },
      }).catch(() => []);
      if (events && events.length > 0) {
        await prisma.processedWebhookEvent.deleteMany({
          where: { id: { in: events.map((e) => e.id) } },
        }).catch(() => {});
      }
      await prisma.processedWebhookEvent.deleteMany({
        where: { id: { contains: String(mockInvoiceId) } },
      }).catch(() => {});
      await prisma.bookingActivityLog.deleteMany({
        where: { bookingId },
      }).catch(() => {});
      await prisma.payment.deleteMany({
        where: { bookingId },
      }).catch(() => {});
      await prisma.invoice.deleteMany({
        where: { bookingId },
      }).catch(() => {});
      await prisma.billingInfo.deleteMany({
        where: { bookingId },
      }).catch(() => {});
      await prisma.passenger.deleteMany({
        where: { bookingId },
      }).catch(() => {});
      await prisma.booking.deleteMany({
        where: { id: bookingId },
      }).catch(() => {});

      // Restore seat
      await prisma.tourAvailability.update({
        where: { id: testSlotId },
        data: { remainingSeats: initialSeats },
      }).catch(() => {});
    }

    await app.close();
    await prisma.$disconnect();
  }, 60000);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Authentication Phase
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 1: User successfully logs in and receives JWT access token & CSRF token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUserEmail,
        password: testUserPassword,
      });

    expect(res.status).toBe(200);
    const data = dataOf(res);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email', testUserEmail);
    expect(data).toHaveProperty('csrfToken');

    // Extract access token from cookies
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies).toBeDefined();

    const accessTokenCookie = cookies?.find((c) => c.startsWith('access_token='));
    expect(accessTokenCookie).toBeDefined();

    accessToken = accessTokenCookie!.split(';')[0].replace('access_token=', '');
    csrfToken = data.csrfToken;
    expect(accessToken).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Pricing Calculation Phase
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 2: Calculate price for tour slot (1 adult = $5.00 USD)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/bookings/calculate')
      .send({
        tourId: testTourId,
        availabilityId: testSlotId,
        date: testDate,
        adults: 1,
        children: 0,
      });

    expect(res.status).toBe(200);
    const data = dataOf(res);
    expect(data.basePriceUsd).toBe('5.00');
    expect(data.totalAmountUsd).toBe('5.00');
    expect(data.currency).toBe('USD');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Booking Creation Phase
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 3: Create booking with authentication, reserving seat and issuing invoice', async () => {
    const idempotencyKey = `bkg_e2e_${Date.now()}`;

    const res = await request(app.getHttpServer())
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
        fullName: 'Test Traveler',
        email: testUserEmail,
        phone: '+201000000000',
        language: 'en',
      });

    expect(res.status).toBe(201);
    const data = dataOf(res);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('referenceCode');
    expect(data).toHaveProperty('invoiceNumber');
    expect(data.status).toBe('PENDING');
    expect(data.totalAmountUsd.toString()).toBe('5');

    bookingId = data.id;
    bookingReference = data.referenceCode;
    invoiceNumber = data.invoiceNumber;

    // Verify DB state immediately after booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });

    expect(booking).toBeDefined();
    expect(booking?.status).toBe('PENDING');
    expect(booking?.totalAmountUsd.toString()).toBe('5');
    expect(booking?.paidAmountUsd.toString()).toBe('0');
    expect(booking?.invoice).toBeDefined();
    expect(booking?.invoice?.status).toBe('SENT');
    expect(booking?.invoice?.total.toString()).toBe('5');

    // Verify capacity was reserved (decremented by 1)
    const slot = await prisma.tourAvailability.findUnique({
      where: { id: testSlotId },
    });
    expect(slot?.remainingSeats).toBe(initialSeats - 1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Payment Initiation Phase via GetPayIn
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 4: Initiate payment via GetPayIn and obtain checkout session URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    expect([200, 201]).toContain(res.status);
    const data = dataOf(res);
    expect(data).toHaveProperty('sessionUrl');
    expect(data).toHaveProperty('paymentId');
    expect(data).toHaveProperty('providerInvoiceId', String(mockInvoiceId));
    expect(data.sessionUrl).toContain('pay.getpayin.com');

    paymentId = data.paymentId;

    // Verify DB Payment record
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });
    expect(payment).toBeDefined();
    expect(payment?.bookingId).toBe(bookingId);
    expect(payment?.provider).toBe('GETPAYIN');
    expect(payment?.status).toBe('PENDING');
    expect(payment?.amount.toString()).toBe('5');
    expect(payment?.currency).toBe('USD');
    expect(payment?.transactionId).toBe(String(mockInvoiceId));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. GetPayIn Webhook Phase (HMAC-SHA256 Signature Verification & State Capture)
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 5: Process signed PayLink webhook (invoice.paid) to capture payment and confirm booking', async () => {
    const paylinkClient = new PaylinkClient({
      publicToken: 'dummy',
      hashToken: hashToken,
    });

    const payload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: mockInvoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment received successfully',
    };

    // Calculate official PayLink HMAC-SHA256 signature using PaylinkClient
    payload.signature = paylinkClient.webhooks.computeSignature(payload, hashToken);

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(payload);

    if (res.status !== 200) {
      console.log('Webhook error response:', res.status, res.body);
    }
    expect(res.status).toBe(200);
    const data = dataOf(res);
    expect(data).toEqual({ received: true });

    // Verify complete financial ledger transition in PostgreSQL
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true, payments: true },
    });

    expect(updatedBooking?.status).toBe('CONFIRMED');
    expect(updatedBooking?.paidAmountUsd.toString()).toBe('5');
    expect(updatedBooking?.invoice?.status).toBe('PAID');

    const updatedPayment = updatedBooking?.payments.find((p) => p.id === paymentId);
    expect(updatedPayment?.status).toBe('CAPTURED');
    expect(updatedPayment?.providerStatus).toBe('PAID');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. GetPayIn Callback Reconciliation Phase
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 6: Reconcile client return callback with valid signature', async () => {
    const callbackPayload = {
      invoice_id: mockInvoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment received successfully',
      signature: '',
    };

    const concatenated = `${callbackPayload.success}${callbackPayload.invoice_id}${callbackPayload.invoice_status}${callbackPayload.message}`;
    callbackPayload.signature = crypto
      .createHmac('sha256', hashToken)
      .update(concatenated, 'utf8')
      .digest('base64');

    const res = await request(app.getHttpServer())
      .post('/api/payments/callback/getpayin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(callbackPayload);

    expect([200, 201]).toContain(res.status);
    const data = dataOf(res);
    expect(data).toHaveProperty('status', 'CAPTURED');
    expect(data).toHaveProperty('paymentId', paymentId);
    expect(data).toHaveProperty('booking');
    expect(data.booking).toHaveProperty('status', 'CONFIRMED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Security: Idempotent Webhook Replay & Forged Signature Rejection
  // ──────────────────────────────────────────────────────────────────────────
  it('Phase 7: Security check - Duplicate webhook is idempotent; forged signature is rejected', async () => {
    const paylinkClient = new PaylinkClient({
      publicToken: 'dummy',
      hashToken: hashToken,
    });

    // 7a. Replay exact same webhook
    const validPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: mockInvoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment received successfully',
    };
    validPayload.signature = paylinkClient.webhooks.computeSignature(validPayload, hashToken);

    const replayRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(validPayload);

    expect(replayRes.status).toBe(200);
    const data = dataOf(replayRes);
    expect(data).toEqual({ received: true });

    // Ensure booking paid amount did NOT double
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(booking?.paidAmountUsd.toString()).toBe('5');

    // 7b. Tampered payload with illegal status
    const forgedPayload = {
      ...validPayload,
      invoice_status: 'VOIDED', // tampered
    };
    const forgedRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(forgedPayload);

    expect(forgedRes.status).toBe(400);
  });
});
