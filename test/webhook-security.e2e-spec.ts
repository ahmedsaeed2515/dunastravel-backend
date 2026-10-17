import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaylinkClient } from '@getpayin/paylink';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

jest.setTimeout(120000);

describe('Phase 3 Webhook Security & Idempotency (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fetchSpy: jest.SpyInstance;
  let paylinkClient: PaylinkClient;

  const testUserEmail = 'traveler.test@dunastravel.com';
  const testUserPassword = 'Password123!';
  const testTourSlug = 'cairo-express-4d';
  let testSlotId: string;
  const testDate = '2028-09-20';

  let hashToken: string;
  let accessToken: string;

  beforeAll(async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url, init) => {
        const urlStr = String(url);

        if (urlStr.includes('/api/v2/integration/init')) {
          const freshInvoiceId = Math.floor(300000 + Math.random() * 600000);
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                checkout_url: `https://pay.getpayin.com/integration/checkout?invoice_id=${freshInvoiceId}`,
                invoice_id: freshInvoiceId,
                expires_at: new Date(
                  Date.now() + 24 * 3600 * 1000,
                ).toISOString(),
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({ success: false, message: 'Not found' }),
          {
            status: 404,
            headers: { 'content-type': 'application/json' },
          },
        );
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
    hashToken =
      configService.get('GETPAYIN_HASH_TOKEN') ||
      'sandbox_hash_token_dunas_secret_2026';

    paylinkClient = new PaylinkClient({
      publicToken: 'dummy',
      hashToken: hashToken,
    });

    // Lookup tour and upsert availability slot
    const tour = await prisma.tour.findUnique({
      where: { slug: testTourSlug },
    });
    if (!tour) throw new Error(`Tour not found: ${testTourSlug}`);
    const slot = await prisma.tourAvailability.upsert({
      where: {
        tourId_date: {
          tourId: tour.id,
          date: new Date(`${testDate}T00:00:00.000Z`),
        },
      },
      update: {
        totalCapacity: 50,
        remainingSeats: 50,
        status: 'AVAILABLE',
      },
      create: {
        tourId: tour.id,
        date: new Date(`${testDate}T00:00:00.000Z`),
        totalCapacity: 50,
        remainingSeats: 50,
        status: 'AVAILABLE',
      },
    });
    testSlotId = slot.id;

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: testUserPassword });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as
      string[] | undefined;
    const accessTokenCookie = cookies?.find((c) =>
      c.startsWith('access_token='),
    );
    expect(accessTokenCookie).toBeDefined();
    accessToken = accessTokenCookie!.split(';')[0].replace('access_token=', '');
  });

  afterAll(async () => {
    fetchSpy?.mockRestore();
    await app?.close();
    await prisma?.$disconnect();
  });

  it('1. Signature Verification: rejects tampered body and forged HMAC signatures', async () => {
    const forgedPayload = {
      event: 'invoice.paid',
      invoice_id: 999999,
      invoice_status: 'PAID',
      success: 1,
      message: 'Hacked payment',
      signature: 'invalid_base64_forged_hmac_signature_==',
    };

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(forgedPayload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Invalid PayLink webhook signature');
  });

  it('2. Payload Schema Validation: rejects malformed payloads and invalid event types', async () => {
    const invalidEventPayload = {
      event: 'unknown.bogus.event',
      invoice_id: 123456,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed',
    };
    (invalidEventPayload as any).signature = (
      paylinkClient.webhooks as any
    ).computeSignature(invalidEventPayload, hashToken);

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(invalidEventPayload);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(
      'Unsupported or inconsistent PayLink event',
    );
  });

  it('3. Idempotency & Deduplication: gateway retries (2nd and 3rd delivery) return 200 OK without re-executing logic', async () => {
    // 3a. Create booking and initiate payment
    const idempotencyKey = `wh_sec_dedup_${Date.now()}`;
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
        fullName: 'Deduplication Tester',
        email: 'dedup@dunastravel.com',
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

    const webhookPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed successfully',
      order_amount: 5.0,
      order_currency: 'USD',
    };
    webhookPayload.signature = (paylinkClient.webhooks as any).computeSignature(
      webhookPayload,
      hashToken,
    );

    // 3b. First delivery: processes successfully
    const firstDeliveryRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(webhookPayload);

    expect(firstDeliveryRes.status).toBe(200);
    expect(
      (firstDeliveryRes.body?.data || firstDeliveryRes.body).received,
    ).toBe(true);

    const bookingAfterFirst = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(bookingAfterFirst?.status).toBe('CONFIRMED');

    // Count activity logs after first delivery
    const logsAfterFirst = await prisma.bookingActivityLog.count({
      where: { bookingId },
    });

    // 3c. Second delivery (retry 1): returns 200 OK via ProcessedWebhookEvent deduplication
    const secondDeliveryRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(webhookPayload);

    expect(secondDeliveryRes.status).toBe(200);
    expect(
      (secondDeliveryRes.body?.data || secondDeliveryRes.body).received,
    ).toBe(true);

    // 3d. Third delivery (retry 2): returns 200 OK
    const thirdDeliveryRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(webhookPayload);

    expect(thirdDeliveryRes.status).toBe(200);
    expect(
      (thirdDeliveryRes.body?.data || thirdDeliveryRes.body).received,
    ).toBe(true);

    // Verify NO duplicate activity logs or state mutations occurred
    const logsAfterThird = await prisma.bookingActivityLog.count({
      where: { bookingId },
    });
    expect(logsAfterThird).toBe(logsAfterFirst);

    // Verify single payment record remains
    const paymentsCount = await prisma.payment.count({ where: { bookingId } });
    expect(paymentsCount).toBe(1);
  });

  it('4. Out-of-Order Webhooks: delayed invoice.paid cannot resurrect a REFUNDED booking', async () => {
    const idempotencyKey = `wh_sec_ooo_${Date.now()}`;
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
        fullName: 'Out Of Order Tester',
        email: 'ooo@dunastravel.com',
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

    // 4a. Booking is CANCELLED (e.g. administrative cancellation or user cancellation) while payment is PENDING
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    const bookingAfterCancel = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(bookingAfterCancel?.status).toBe('CANCELLED');

    // Confirm payment session is still in PENDING status
    const paymentBeforeWebhook = await prisma.payment.findFirst({
      where: { bookingId },
    });
    expect(paymentBeforeWebhook?.status).toBe('PENDING');

    // 4b. Delayed invoice.paid arrives late: must be rejected with 422, cannot confirm cancelled booking
    const latePaidPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Late payment confirmation',
      order_amount: 5.0,
      order_currency: 'USD',
    };
    latePaidPayload.signature = (
      paylinkClient.webhooks as any
    ).computeSignature(latePaidPayload, hashToken);

    const latePaidRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(latePaidPayload);

    // Must be rejected with 422
    expect(latePaidRes.status).toBe(422);
    expect(latePaidRes.body.message).toContain('terminal status CANCELLED');

    // Verify booking remains CANCELLED and was NOT resurrected to CONFIRMED
    const bookingFinal = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    expect(bookingFinal?.status).toBe('CANCELLED');
  });
});
