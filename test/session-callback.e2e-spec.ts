import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PaylinkClient } from '@getpayin/paylink';
import crypto from 'crypto';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

jest.setTimeout(120000);

describe('Phase 5 Redirect/Callback & Session Handling (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
        const freshInvoiceId = Math.floor(600000 + Math.random() * 300000);
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

      if (urlStr.includes('check-status')) {
        let invoiceId = 700000;
        try {
          const body = JSON.parse(String(init?.body));
          if (body.invoice_id) invoiceId = Number(body.invoice_id);
        } catch {
          // ignore
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              invoice_id: invoiceId,
              paid_status: 'PAID',
              auth_code: '831000',
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
    app.use(cookieParser());
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableVersioning({ type: VersioningType.URI });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    const configService = app.get(ConfigService);
    hashToken = configService.get<string>('GETPAYIN_HASH_TOKEN') || 'sandbox_hash_token_dunas_secret_2026';

    paylinkClient = new PaylinkClient({
      publicToken: 'dummy',
      hashToken: hashToken,
    });

    // Ensure slot has seats
    await prisma.tourAvailability.update({
      where: { id: testSlotId },
      data: { totalCapacity: 50, remainingSeats: 50, status: 'AVAILABLE' },
    });

    // Login to obtain JWT accessToken
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testUserEmail, password: testUserPassword });
    const cookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
    const accessTokenCookie = cookies?.find((c) => c.startsWith('access_token='));
    accessToken = accessTokenCookie
      ? accessTokenCookie.split(';')[0].replace('access_token=', '')
      : (loginRes.body?.data?.accessToken || loginRes.body?.accessToken);
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    if (app) {
      await app.close();
    }
  });

  it('1. Session Expiration on 3DS Return: authenticated booking accessible via persistent guest token fallback', async () => {
    const persistentBrowserToken = `gt_persistent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const idempotencyKey = `sess_exp_${Date.now()}`;

    // 1a. Authenticated user creates booking while browser attaches persistent x-guest-token header
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', idempotencyKey)
      .set('x-guest-token', persistentBrowserToken)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        fullName: 'Session Expiry Tester',
        email: 'session.expiry@dunastravel.com',
        phone: '+201000008899',
        language: 'en',
      });

    expect(bookingRes.status).toBe(201);
    const bookingId = (bookingRes.body?.data || bookingRes.body).id;
    expect(bookingId).toBeDefined();

    // 1b. Initiate payment checkout session
    const initiateRes = await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    expect(initiateRes.status).toBe(201);
    const paymentId = (initiateRes.body?.data || initiateRes.body).paymentId;
    expect(paymentId).toBeDefined();

    // 1c. User undergoes 3DS bank verification. Session cookie expires (no Authorization header).
    // Browser returns to confirmation screen presenting only the persistent x-guest-token header.
    const statusRes = await request(app.getHttpServer())
      .get(`/api/payments/${paymentId}/status`)
      .set('x-guest-token', persistentBrowserToken);

    expect(statusRes.status).toBe(200);
    const statusData = statusRes.body?.data || statusRes.body;
    expect(statusData.paymentId).toBe(paymentId);
    expect(statusData.status).toBe('PENDING');
    expect(statusData.booking.id).toBe(bookingId);
  });

  it('2. Verified PayLink Callback: reconciles return even if user JWT expired completely', async () => {
    const bookingId = crypto.randomUUID();
    const referenceCode = `DUNAS-CB-${Date.now().toString().slice(-6)}`;
    const providerInvoiceId = String(Math.floor(700000 + Math.random() * 200000));

    // Create a dummy pending payment record directly
    await prisma.booking.create({
      data: {
        id: bookingId,
        referenceCode,
        tourId: (await prisma.tour.findFirst({ select: { id: true } }))!.id,
        arrivalDate: new Date(testDate),
        status: 'PENDING',
        adults: 1,
        totalAmountUsd: 10.00,
        paidAmountUsd: 0.00,
      },
    });

    const paymentId = crypto.randomUUID();
    await prisma.payment.create({
      data: {
        id: paymentId,
        bookingId,
        provider: 'GETPAYIN',
        providerPaymentId: providerInvoiceId,
        transactionId: providerInvoiceId,
        method: 'GETPAYIN',
        amount: 10.00,
        currency: 'USD',
        status: 'PENDING',
        providerStatus: 'PENDING',
      },
    });

    // 2a. PayLink redirects user back with signed callback payload
    const callbackPayload: Record<string, any> = {
      invoice_id: providerInvoiceId,
      success: 1,
      invoice_status: 'PAID',
      message: 'Payment completed successfully',
    };
    callbackPayload.signature = (paylinkClient.webhooks as any).computeSignature(callbackPayload, hashToken);

    // Request made WITHOUT any Authorization header (session expired)
    const callbackRes = await request(app.getHttpServer())
      .post('/api/payments/callback/getpayin')
      .send(callbackPayload);

    expect(callbackRes.status).toBe(201);
    const responseData = callbackRes.body?.data || callbackRes.body;
    expect(responseData.paymentId).toBe(paymentId);
    expect(['CAPTURED', 'SUCCEEDED', 'PENDING']).toContain(responseData.status);
    expect(responseData.booking.id).toBe(bookingId);
  });

  it('3. Forged PayLink Callback Rejection: tampering with signature is strictly blocked', async () => {
    const forgedPayload = {
      invoice_id: '999999',
      success: 1,
      invoice_status: 'PAID',
      message: 'Tampered payment',
      signature: 'invalid_forged_hmac_signature',
    };

    const forgedRes = await request(app.getHttpServer())
      .post('/api/payments/callback/getpayin')
      .send(forgedPayload);

    // Must be rejected as Bad Request due to invalid signature
    expect(forgedRes.status).toBe(400);
  });
});
