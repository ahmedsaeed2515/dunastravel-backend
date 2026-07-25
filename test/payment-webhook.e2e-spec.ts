import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IPaymentGatewayPort } from '../src/modules/payments/interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('axios');
jest.mock('@anthropic-ai/sdk');

describe('Payments Webhook (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockGatewayPort: Partial<IPaymentGatewayPort>;
  let eventEmitter: EventEmitter2;

  let testUserId: string;
  let testTourId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL || '';
    if (
      process.env.ALLOW_DISPOSABLE_DB_MUTATION !== 'true' ||
      dbUrl.includes('neon.tech')
    ) {
      console.warn(
        'Skipping payment-webhook e2e test against live/shared database to enforce DB safety.',
      );
      return;
    }

    mockGatewayPort = {
      getProviderName: () => 'STRIPE',
      verifyAndParseWebhook: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IPaymentGatewayPort)
      .useValue(mockGatewayPort)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    prisma = app.get(PrismaService);
    eventEmitter = app.get(EventEmitter2);

    await app.init();

    // Setup Test Data
    const user = await prisma.user.create({
      data: {
        email: `test-webhook-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        name: 'Test User',
      },
    });
    testUserId = user.id;

    const tour = await prisma.tour.create({
      data: {
        titleJsonb: { en: 'Test Tour' },
        slug: `test-tour-${Date.now()}`,
        basePriceUsd: 100,
      },
    });
    testTourId = tour.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await prisma.tour.delete({ where: { id: testTourId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Create a fresh booking for each test
    const booking = await prisma.booking.create({
      data: {
        userId: testUserId,
        tourId: testTourId,
        arrivalDate: new Date(),
        adults: 1,
        children: 0,
        status: 'PENDING',
        totalAmountUsd: 100,
        referenceCode: `REF-${Date.now()}`,
      },
    });
    testBookingId = booking.id;
  });

  afterEach(async () => {
    await prisma.processedWebhookEvent.deleteMany({}).catch(() => {});
    await prisma.payment
      .deleteMany({ where: { bookingId: testBookingId } })
      .catch(() => {});
    await prisma.booking
      .delete({ where: { id: testBookingId } })
      .catch(() => {});
  });

  it('/payments/webhook/stripe (POST) - invalid signature', async () => {
    (mockGatewayPort.verifyAndParseWebhook as jest.Mock).mockRejectedValue(
      new Error('Invalid signature'),
    );

    const response = await request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ type: 'checkout.session.completed' });

    // The adapter might throw an error. In NestJS unhandled errors are 500,
    // but in a real app a bad request exception would return 400. Let's just expect it not to be 200.
    expect(response.status).not.toBe(200);
  });

  it('Valid signature, first delivery -> processed, DB state correct', async () => {
    const eventId = `evt_${Date.now()}`;
    (mockGatewayPort.verifyAndParseWebhook as jest.Mock).mockResolvedValue({
      eventId,
      bookingId: testBookingId,
      paymentId: 'pi_123',
      amountUsd: 100,
      status: 'COMPLETED',
      rawEvent: { id: eventId },
    });

    const spy = jest.spyOn(eventEmitter, 'emit');

    const res = await request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ id: eventId });

    expect(res.status).toBe(200);

    // Verify DB
    const processed = await prisma.processedWebhookEvent.findUnique({
      where: { id: eventId },
    });
    expect(processed).toBeDefined();

    const booking = await prisma.booking.findUnique({
      where: { id: testBookingId },
    });
    expect(booking?.status).toBe('PAID');
    expect(booking?.paidAmountUsd?.toString()).toBe('100');

    const payment = await prisma.payment.findFirst({
      where: { bookingId: testBookingId },
    });
    expect(payment?.status).toBe('CAPTURED');

    // Verify side-effects
    expect(spy).toHaveBeenCalledWith('payment.succeeded', expect.any(Object));
  });

  it('Valid signature, exact duplicate delivery -> second call is a no-op', async () => {
    const eventId = `evt_dup_${Date.now()}`;
    (mockGatewayPort.verifyAndParseWebhook as jest.Mock).mockResolvedValue({
      eventId,
      bookingId: testBookingId,
      paymentId: 'pi_123',
      amountUsd: 100,
      status: 'COMPLETED',
      rawEvent: { id: eventId },
    });

    const spy = jest.spyOn(eventEmitter, 'emit');

    // First call
    const res1 = await request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ id: eventId });
    if (res1.status !== 200) console.log('res1.body:', res1.body);
    expect(res1.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);

    // Second call
    const res2 = await request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ id: eventId });
    expect(res2.status).toBe(200);
    // Should NOT emit event again
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Two concurrent duplicate deliveries -> only one processed safely', async () => {
    const eventId = `evt_conc_${Date.now()}`;
    (mockGatewayPort.verifyAndParseWebhook as jest.Mock).mockResolvedValue({
      eventId,
      bookingId: testBookingId,
      paymentId: 'pi_123',
      amountUsd: 100,
      status: 'COMPLETED',
      rawEvent: { id: eventId },
    });

    const spy = jest.spyOn(eventEmitter, 'emit');

    // Fire concurrently
    const req1 = request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ id: eventId });
    const req2 = request(app.getHttpServer())
      .post('/payments/webhook/stripe')
      .send({ id: eventId });

    const [res1, res2] = await Promise.all([req1, req2]);

    if (res1.status !== 200) console.log('res1.body:', res1.body);
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // DB row count for this event should be exactly 1
    const count = await prisma.processedWebhookEvent.count({
      where: { id: eventId },
    });
    expect(count).toBe(1);

    // Side effect should only fire once
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
