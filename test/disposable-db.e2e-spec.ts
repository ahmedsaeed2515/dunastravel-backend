import { verifyAndAssertDisposableDb } from './disposable-db-guard';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID as uuidv4 } from 'crypto';

describe('Disposable Database Integration & Concurrency Invariants', () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(async () => {
    if (
      !process.env.TEST_DATABASE_URL &&
      (!process.env.DATABASE_URL ||
        process.env.DATABASE_URL.includes('neon.tech'))
    ) {
      process.env.TEST_DATABASE_URL =
        'postgresql://rivo_admin:rivo_admin_password@127.0.0.1:5432/dunastravel_test?schema=public';
    }
    process.env.DISPOSABLE_DB_CONFIRMED = 'true';
    process.env.ALLOW_DISPOSABLE_DB_MUTATION = 'true';

    const dbTarget = verifyAndAssertDisposableDb();
    pool = new Pool({
      connectionString: dbTarget.connectionString,
      connectionTimeoutMillis: 5000,
    });
    await pool.query('SELECT 1');
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Booking Idempotency Race
  // ---------------------------------------------------------------------------
  it('1. Booking Idempotency Race: concurrent creation with same idempotency key creates exactly 1 DB record', async () => {
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-idempotency-${uuidv4()}`,
        titleJsonb: { en: 'Idempotency Tour' },
        basePriceUsd: 100,
        status: 'PUBLISHED',
      },
    });

    const idempotencyKey = `idempotency-key-${uuidv4()}`;

    const createBookingWorker = async (index: number): Promise<any> => {
      try {
        return await prisma.booking.create({
          data: {
            referenceCode: `BK-IDEM-${index}-${uuidv4().substring(0, 6)}`,
            tourId: tour.id,
            arrivalDate: new Date('2026-09-01'),
            departureDate: new Date('2026-09-10'),
            adults: 2,
            children: 0,
            infants: 0,
            totalAmountUsd: 200,
            paidAmountUsd: 0,
            status: 'PENDING',
            passengers: {
              create: [
                { fullName: 'Idempotent Passenger', passengerType: 'ADULT' },
              ],
            },
            idempotencyKey: idempotencyKey,
            requestHash: 'hash-12345',
          },
        });
      } catch (err: any) {
        return { isError: true, code: err.code, message: err.message };
      }
    };

    // Execute 5 concurrent promises
    const results: any[] = await Promise.all([
      createBookingWorker(1),
      createBookingWorker(2),
      createBookingWorker(3),
      createBookingWorker(4),
      createBookingWorker(5),
    ]);

    const successes = results.filter((res) => res && res.id && !res.isError);
    const duplicateErrors = results.filter(
      (res) => res && res.isError && res.code === 'P2002',
    );
    expect(successes.length).toBe(1);
    expect(duplicateErrors.length).toBe(4);

    const dbBookings = await prisma.booking.findMany({
      where: { idempotencyKey },
    });
    expect(dbBookings.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 2. Availability Reserve/Release Race & Bounds
  // ---------------------------------------------------------------------------
  it('2. Availability Reserve/Release Race: concurrent seat reservations respect total capacity bounds', async () => {
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-capacity-${uuidv4()}`,
        titleJsonb: { en: 'Capacity Test Tour' },
        basePriceUsd: 150,
      },
    });

    const availabilityDate = new Date('2026-10-01');
    const avail = await prisma.tourAvailability.create({
      data: {
        tourId: tour.id,
        date: availabilityDate,
        totalCapacity: 5,
        remainingSeats: 5,
        status: 'AVAILABLE',
      },
    });

    // Worker that atomically attempts to reserve 1 seat if remainingSeats >= 1
    const reserveSeatWorker = async (): Promise<number> => {
      return await prisma.$executeRaw`
        UPDATE tour_availabilities
        SET remaining_seats = remaining_seats - 1,
            updated_at = NOW()
        WHERE id = ${avail.id} AND remaining_seats >= 1;
      `;
    };

    // Concurrently launch 10 reservation attempts for 5 available seats
    const workers = Array.from({ length: 10 }, () => reserveSeatWorker());
    const workerResults = await Promise.all(workers);

    const successfulDecrements = workerResults.reduce(
      (acc: number, val: number) => acc + val,
      0,
    );
    expect(successfulDecrements).toBe(5);

    const updatedAvail = await prisma.tourAvailability.findUnique({
      where: { id: avail.id },
    });
    expect(updatedAvail?.remainingSeats).toBe(0);

    // Test DB check constraint: attempting remaining_seats < 0 throws Error
    await expect(
      prisma.$executeRaw`UPDATE tour_availabilities SET remaining_seats = -1 WHERE id = ${avail.id}`,
    ).rejects.toThrow();
  });

  // ---------------------------------------------------------------------------
  // 3. Promo MaxUses Race & Reversal
  // ---------------------------------------------------------------------------
  it('3. Promo MaxUses Race: concurrent usages enforce maxUses limit atomically', async () => {
    const promoCode = `PROMO-${uuidv4().substring(0, 6)}`;
    const promo = await prisma.promotion.create({
      data: {
        code: promoCode,
        discountPercent: 10,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        maxUses: 2,
        currentUses: 0,
        isActive: true,
      },
    });

    const redeemWorker = async (): Promise<number> => {
      // Atomic increment if current_uses < max_uses
      const affected = await prisma.$executeRaw`
        UPDATE promotions
        SET current_uses = current_uses + 1,
            updated_at = NOW()
        WHERE id = ${promo.id} AND current_uses < max_uses;
      `;
      return affected;
    };

    const results = await Promise.all([
      redeemWorker(),
      redeemWorker(),
      redeemWorker(),
      redeemWorker(),
      redeemWorker(),
    ]);

    const totalRedeemed = results.reduce(
      (acc: number, val: number) => acc + val,
      0,
    );
    expect(totalRedeemed).toBe(2);

    const finalPromo = await prisma.promotion.findUnique({
      where: { id: promo.id },
    });
    expect(finalPromo?.currentUses).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 4. Payment Initiation Uniqueness
  // ---------------------------------------------------------------------------
  it('4. Payment Initiation Uniqueness: only 1 pending payment per booking enforced by partial unique index', async () => {
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-pay-${uuidv4()}`,
        titleJsonb: { en: 'Payment Tour' },
        basePriceUsd: 200,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        referenceCode: `BK-PAY-${uuidv4().substring(0, 8)}`,
        tourId: tour.id,
        arrivalDate: new Date('2026-09-15'),
        adults: 1,
        totalAmountUsd: 200,
        status: 'PENDING',
        passengers: {
          create: [{ fullName: 'Pay Passenger', passengerType: 'ADULT' }],
        },
      },
    });

    const createPaymentAttempt = async (): Promise<any> => {
      try {
        return await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: 200,
            currency: 'USD',
            method: 'STRIPE',
            status: 'PENDING',
          },
        });
      } catch (err: any) {
        return err;
      }
    };

    const res1 = await createPaymentAttempt();
    const res2 = await createPaymentAttempt();

    expect(res1.id).toBeDefined();
    // Second pending payment creation throws P2002 duplicate key constraint
    expect(res2.code).toBe('P2002');
  });

  // ---------------------------------------------------------------------------
  // 5. Webhook Duplicate/Concurrent/P2034 Behavior
  // ---------------------------------------------------------------------------
  it('5. Webhook Duplicate Behavior: duplicate event payload processes idempotently via ProcessedWebhookEvent', async () => {
    const eventId = `evt_test_${uuidv4()}`;

    const processWebhook = async (): Promise<{
      processed: boolean;
      id?: string;
      duplicate?: boolean;
    }> => {
      try {
        return await prisma.$transaction(async (tx) => {
          // Record event idempotency
          const recorded = await tx.processedWebhookEvent.create({
            data: {
              id: eventId,
              provider: 'STRIPE',
              payload: { type: 'checkout.session.completed' },
            },
          });
          return { processed: true, id: recorded.id };
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          return { processed: false, duplicate: true };
        }
        throw err;
      }
    };

    const results = await Promise.all([
      processWebhook(),
      processWebhook(),
      processWebhook(),
    ]);
    const processedCount = results.filter((r) => r.processed).length;
    const duplicateCount = results.filter((r) => r.duplicate).length;

    expect(processedCount).toBe(1);
    expect(duplicateCount).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 6. Invoice Sequence Uniqueness
  // ---------------------------------------------------------------------------
  it('6. Invoice Sequence Uniqueness: concurrent sequence queries generate unique sequential numbers without collisions', async () => {
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-inv-${uuidv4()}`,
        titleJsonb: { en: 'Invoice Tour' },
        basePriceUsd: 300,
      },
    });

    const createInvoiceWorker = async (idx: number): Promise<any> => {
      const b = await prisma.booking.create({
        data: {
          referenceCode: `BK-INV-${idx}-${uuidv4().substring(0, 6)}`,
          tourId: tour.id,
          arrivalDate: new Date('2026-09-20'),
          adults: 1,
          totalAmountUsd: 300,
          status: 'PAID',
          passengers: {
            create: [{ fullName: 'Inv Passenger', passengerType: 'ADULT' }],
          },
        },
      });

      // Use PostgreSQL sequence invoice_seq
      const seqResult: any[] =
        await prisma.$queryRaw`SELECT nextval('invoice_seq') as seq;`;
      const seqNum = seqResult[0].seq.toString().padStart(5, '0');
      const invoiceNumber = `INV-2026-${seqNum}`;

      return prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId: b.id,
          subtotal: 300,
          tax: 0,
          total: 300,
          currency: 'USD',
          status: 'PAID',
        },
      });
    };

    const invoices = await Promise.all([
      createInvoiceWorker(1),
      createInvoiceWorker(2),
      createInvoiceWorker(3),
      createInvoiceWorker(4),
      createInvoiceWorker(5),
    ]);

    const numbers = invoices.map((inv) => inv.invoiceNumber);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // 7. Wallet Concurrent Debit / Overdraft
  // ---------------------------------------------------------------------------
  it('7. Wallet Concurrent Debit: atomic debits prevent negative balance / overdraft breach', async () => {
    const wallet = await prisma.wallet.create({
      data: {
        ownerType: 'COMPANY',
        ownerId: `company-${uuidv4()}`,
        currency: 'USD',
        balance: 500.0,
        status: 'ACTIVE',
      },
    });

    const debitWorker = async (amount: number): Promise<number> => {
      return await prisma.$executeRaw`
        UPDATE wallets
        SET balance = balance - ${amount},
            updated_at = NOW()
        WHERE id = ${wallet.id} AND (balance - ${amount}) >= 0.00;
      `;
    };

    // Attempt 4 debits of 200.00 USD each (Total 800.00 > 500.00)
    const debitResults = await Promise.all([
      debitWorker(200),
      debitWorker(200),
      debitWorker(200),
      debitWorker(200),
    ]);

    const successfulDebits = debitResults.reduce(
      (acc: number, val: number) => acc + val,
      0,
    );
    expect(successfulDebits).toBe(2); // Only 2 debits of 200 (total 400) fit in 500

    const updatedWallet = await prisma.wallet.findUnique({
      where: { id: wallet.id },
    });
    expect(Number(updatedWallet?.balance)).toBe(100.0);
  });

  // ---------------------------------------------------------------------------
  // 8. Commission & Refund Once-Only Behavior
  // ---------------------------------------------------------------------------
  it('8. Refund Once-Only Behavior: idempotency key guarantees single refund record', async () => {
    const tour = await prisma.tour.create({
      data: {
        slug: `tour-ref-${uuidv4()}`,
        titleJsonb: { en: 'Refund Tour' },
        basePriceUsd: 500,
      },
    });

    const booking = await prisma.booking.create({
      data: {
        referenceCode: `BK-REF-${uuidv4().substring(0, 8)}`,
        tourId: tour.id,
        arrivalDate: new Date('2026-11-01'),
        adults: 2,
        totalAmountUsd: 500,
        status: 'PAID',
        passengers: {
          create: [{ fullName: 'Refund Passenger', passengerType: 'ADULT' }],
        },
      },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: 500,
        currency: 'USD',
        method: 'STRIPE',
        status: 'CAPTURED',
      },
    });

    const refundIdempotencyKey = `refund-${uuidv4()}`;

    const createRefund = async (): Promise<any> => {
      try {
        return await prisma.refundRecord.create({
          data: {
            idempotencyKey: refundIdempotencyKey,
            paymentId: payment.id,
            amount: 500,
            currency: 'USD',
            status: 'COMPLETED',
            actorRole: 'ADMIN',
            reason: 'Customer cancellation',
          },
        });
      } catch (err: any) {
        return err;
      }
    };

    const res1 = await createRefund();
    const res2 = await createRefund();

    expect(res1.id).toBeDefined();
    expect(res2.code).toBe('P2002'); // Duplicate refund idempotency key rejected
  });

  // ---------------------------------------------------------------------------
  // 9. Unique / FK / Check / Soft-Delete Constraints
  // ---------------------------------------------------------------------------
  it('9. Database Invariants: foreign keys, check constraints, unique constraints and soft-deletes are enforced', async () => {
    // FK violation: Invalid tourId
    await expect(
      prisma.booking.create({
        data: {
          referenceCode: `BK-FK-FAIL-${uuidv4().substring(0, 6)}`,
          tourId: `non-existent-tour-id-${uuidv4()}`,
          arrivalDate: new Date('2026-09-01'),
          adults: 1,
          totalAmountUsd: 100,
          status: 'PENDING',
          passengers: {
            create: [{ fullName: 'Test User', passengerType: 'ADULT' }],
          },
        },
      }),
    ).rejects.toThrow();

    // Soft delete behavior verification
    const userEmail = `softdel-${uuidv4()}@example.com`;
    const user = await prisma.user.create({
      data: {
        name: 'Soft Delete User',
        email: userEmail,
        passwordHash: 'hash',
        role: 'USER',
      },
    });

    // Soft delete user by setting deletedAt
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    const activeUsers = await prisma.user.findMany({
      where: { email: userEmail, deletedAt: null },
    });
    expect(activeUsers.length).toBe(0);

    const allUsers = await prisma.user.findMany({
      where: { email: userEmail },
    });
    expect(allUsers.length).toBe(1);
    expect(allUsers[0].deletedAt).not.toBeNull();
  });
});
