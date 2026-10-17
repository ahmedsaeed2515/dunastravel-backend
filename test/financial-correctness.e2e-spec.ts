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
import { Prisma } from '@prisma/client';
import { PaylinkClient } from '@getpayin/paylink';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

jest.setTimeout(120000);

describe('Phase 2 Financial Correctness (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fetchSpy: jest.SpyInstance;
  let paylinkClient: PaylinkClient;

  const testUserEmail = 'traveler.test@dunastravel.com';
  const testUserPassword = 'Password123!';
  const testTourSlug = 'cairo-express-4d';
  let testSlotId: string;
  const testDate = '2028-09-16';

  let hashToken: string;
  let accessToken: string;
  let capturedGatewayInitPayload: any = null;

  beforeAll(async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url, init) => {
        const urlStr = String(url);

        if (urlStr.includes('/api/v2/integration/init')) {
          const body = JSON.parse(String(init?.body || '{}'));
          capturedGatewayInitPayload = body;
          const freshInvoiceId = Math.floor(200000 + Math.random() * 700000);

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

        if (urlStr.includes('/api/integration/check-status')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                invoice_id: 123456,
                paid_status: 'PAID',
                auth_code: 'AUTH-GETPAYIN-TEST',
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

    // Upsert availability slot for testDate
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
    try {
      fetchSpy?.mockRestore();
    } catch {
      // ignore
    }
    try {
      await app?.close();
    } catch {
      // ignore
    }
    try {
      await prisma?.$disconnect();
    } catch {
      // ignore
    }
  });

  it('1. Price derivation: ignores client-supplied price and calculates server-side', async () => {
    // 1a. Attempting to inject pricing fields via client payload is rejected by API validation
    const adversarialRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', `adv_price_${Date.now()}`)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        fullName: 'Price Injector',
        email: 'attacker@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
        totalAmountUsd: '0.01',
        price: '0.01',
      });

    expect(adversarialRes.status).toBe(400);

    // 1b. Legitimate booking derives price ($5.00) strictly from database rules
    const idempotencyKey = `fin_price_test_${Date.now()}`;
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
        fullName: 'Price Derivation Tester',
        email: 'pricedev@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    expect(res.status).toBe(201);
    const bookingData = res.body?.data || res.body;

    expect(Number(bookingData.totalAmountUsd)).toBe(5.0);

    const bookingInDb = await prisma.booking.findUnique({
      where: { id: bookingData.id },
      include: { invoice: true },
    });
    expect(Number(bookingInDb?.totalAmountUsd)).toBe(5.0);
    expect(Number(bookingInDb?.invoice?.total)).toBe(5.0);
  });

  it('2. Gateway amount matching: sends exact server-calculated amount and USD currency to PayLink', async () => {
    const idempotencyKey = `fin_gw_match_${Date.now()}`;
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
        fullName: 'Gateway Match Tester',
        email: 'gwmatch@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    const bookingId = (bookingRes.body?.data || bookingRes.body).id;

    const initRes = await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    expect(initRes.status).toBe(201);

    expect(capturedGatewayInitPayload).toBeDefined();
    expect(capturedGatewayInitPayload.order_amount).toBe('5.00');
    expect(capturedGatewayInitPayload.currency).toBe('USD');

    const paymentInDb = await prisma.payment.findFirst({
      where: { bookingId },
    });
    expect(Number(paymentInDb?.amount)).toBe(5.0);
    expect(paymentInDb?.currency).toBe('USD');
  });

  it('3. Webhook amount mismatch rejection: rejects webhook when reported amount does not match expected payment amount', async () => {
    const idempotencyKey = `fin_mismatch_test_${Date.now()}`;
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
        fullName: 'Mismatch Tester',
        email: 'mismatch@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    const bookingId = (bookingRes.body?.data || bookingRes.body).id;

    await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId });

    const payment = await prisma.payment.findFirst({ where: { bookingId } });
    expect(payment?.transactionId).toBeDefined();
    const invoiceId = Number(payment!.transactionId);

    // Fraudulent webhook reporting $1.00 instead of $5.00
    const fraudPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed successfully',
      order_amount: 1.0, // Tampered amount!
      order_currency: 'USD',
      paid_amount: 1.0,
    };
    fraudPayload.signature = (paylinkClient.webhooks as any).computeSignature(
      fraudPayload,
      hashToken,
    );

    const webhookRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(fraudPayload);

    // Must be rejected with 422 Unprocessable Entity
    expect(webhookRes.status).toBe(422);
    expect(webhookRes.body.message).toContain('Gateway reported amount');

    // Verify DB integrity: Payment and Booking must remain PENDING
    const paymentAfter = await prisma.payment.findFirst({
      where: { bookingId },
    });
    const bookingAfter = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    const invoiceAfter = await prisma.invoice.findFirst({
      where: { bookingId },
    });

    expect(paymentAfter?.status).toBe('PENDING');
    expect(bookingAfter?.status).toBe('PENDING');
    expect(invoiceAfter?.status).toBe('SENT');
  });

  it('4. Webhook currency mismatch rejection: rejects webhook when reported currency is not USD', async () => {
    const idempotencyKey = `fin_curr_mismatch_${Date.now()}`;
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
        fullName: 'Currency Mismatch Tester',
        email: 'currmismatch@dunastravel.com',
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

    // Currency mismatch webhook (EUR instead of USD)
    const currMismatchPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed successfully',
      order_amount: 5.0,
      order_currency: 'EUR', // Mismatched currency!
    };
    currMismatchPayload.signature = (
      paylinkClient.webhooks as any
    ).computeSignature(currMismatchPayload, hashToken);

    const webhookRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(currMismatchPayload);

    expect(webhookRes.status).toBe(422);
    expect(webhookRes.body.message).toContain('Gateway reported currency');
  });

  it('5. Authentic webhook capture: correctly transitions Payment, Booking, and Invoice in single atomic transaction', async () => {
    const idempotencyKey = `fin_auth_capture_${Date.now()}`;
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
        fullName: 'Authentic Capture Tester',
        email: 'authcapture@dunastravel.com',
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

    // Authentic webhook matching amount and currency
    const authenticPayload: Record<string, any> = {
      event: 'invoice.paid',
      invoice_id: invoiceId,
      invoice_status: 'PAID',
      success: 1,
      message: 'Payment completed successfully',
      order_amount: 5.0,
      order_currency: 'USD',
    };
    authenticPayload.signature = (
      paylinkClient.webhooks as any
    ).computeSignature(authenticPayload, hashToken);

    const webhookRes = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send(authenticPayload);

    expect(webhookRes.status).toBe(200);
    const webhookData = webhookRes.body?.data || webhookRes.body;
    expect(webhookData.received).toBe(true);

    // Verify all 3 transitions occurred atomically
    const paymentAfter = await prisma.payment.findFirst({
      where: { bookingId },
    });
    const bookingAfter = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    const invoiceAfter = await prisma.invoice.findFirst({
      where: { bookingId },
    });

    expect(paymentAfter?.status).toBe('CAPTURED');
    expect(paymentAfter?.providerStatus).toBe('PAID');
    expect(bookingAfter?.status).toBe('CONFIRMED');
    expect(Number(bookingAfter?.paidAmountUsd)).toBe(5.0);
    expect(invoiceAfter?.status).toBe('PAID');
  });

  it('6. Discount limits & non-payable zero-amount edge cases', async () => {
    // 6a. Database check constraint enforces discount_percent <= 90 (promotions cannot produce 100% discount)
    await expect(
      prisma.promotion.create({
        data: {
          code: `OVERLIMIT_${Date.now()}`,
          discountPercent: new Prisma.Decimal(100),
          isActive: true,
          validFrom: new Date(Date.now() - 3600000),
          validUntil: new Date(Date.now() + 86400000),
          maxUses: 10,
          currentUses: 0,
        },
      }),
    ).rejects.toThrow(/promotions_discount_percent_range/);

    // 6b. Maximum valid promotion (90%) applies correctly
    const maxPromoCode = `MAX90_${Date.now()}`;
    await prisma.promotion.create({
      data: {
        code: maxPromoCode,
        discountPercent: new Prisma.Decimal(90),
        isActive: true,
        validFrom: new Date(Date.now() - 3600000),
        validUntil: new Date(Date.now() + 86400000),
        maxUses: 10,
        currentUses: 0,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('idempotency-key', `fin_max_promo_${Date.now()}`)
      .send({
        type: 'booking',
        tourId: testTourSlug,
        availabilityId: testSlotId,
        arrivalDate: testDate,
        adults: 1,
        children: 0,
        promoCode: maxPromoCode,
        fullName: 'Max Promo Traveler',
        email: 'maxpromo@dunastravel.com',
        phone: '+201000001234',
        language: 'en',
      });

    expect(res.status).toBe(201);
    const bookingData = res.body?.data || res.body;

    // $5.00 minus 90% ($4.50) = $0.50
    expect(Number(bookingData.totalAmountUsd)).toBe(0.5);
    expect(bookingData.paymentRequired).toBe(true);
    expect(bookingData.status).toBe('PENDING');

    // 6c. If a booking has status CONFIRMED or $0, payment initiation is blocked
    const user = await prisma.user.findUnique({
      where: { email: testUserEmail },
    });
    const tour = await prisma.tour.findFirst({ where: { slug: testTourSlug } });
    const zeroRef = `BKG-Z${Date.now().toString().slice(-6)}`;

    const zeroBooking = await prisma.booking.create({
      data: {
        referenceCode: zeroRef,
        userId: user!.id,
        tourId: tour!.id,
        availabilityId: testSlotId,
        arrivalDate: new Date(`${testDate}T00:00:00.000Z`),
        adults: 1,
        totalAmountUsd: new Prisma.Decimal(0),
        paidAmountUsd: new Prisma.Decimal(0),
        status: 'CONFIRMED',
      },
    });

    const initZeroRes = await request(app.getHttpServer())
      .post('/api/payments/initiate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bookingId: zeroBooking.id });

    expect(initZeroRes.status).toBe(400);
    expect(initZeroRes.body.message).toContain('cannot be paid');
  });
});
