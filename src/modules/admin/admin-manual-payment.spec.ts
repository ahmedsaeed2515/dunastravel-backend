import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminService } from './admin.service';

describe('Admin Manual Payment Multi-Currency & Server Authority', () => {
  let adminService: AdminService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        await Promise.resolve();
        return cb(mockPrisma);
      }),
      $queryRaw: jest.fn(),
      payment: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'pay-1', ...data }),
          ),
      },
      booking: {
        update: jest.fn().mockResolvedValue({ id: 'bkg-1' }),
      },
      invoice: {
        findUnique: jest.fn().mockResolvedValue({ id: 'inv-1' }),
        update: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      },
      bookingActivityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    adminService = new AdminService(
      mockPrisma,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );
  });

  it('records USD manual payment with authoritative USD currency and updates booking status', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'bkg-usd',
        totalAmountUsd: new Prisma.Decimal('500.00'),
        paidAmountUsd: new Prisma.Decimal('0.00'),
        currency: 'USD',
        originalAmount: null,
        status: 'PENDING',
      },
    ]);

    const result = await adminService.recordManualBookingPayment(
      'BKG-USD-1',
      { amount: 500.0, method: 'CASH', currency: 'USD' },
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONFIRMED');
    expect(result.newPaidAmount).toBe('500.00');
    expect(result.balanceDue).toBe('0.00');
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: 'USD',
          amount: new Prisma.Decimal('500.00'),
        }),
      }),
    );
  });

  it('records EUR manual payment using originalAmount and preserves EUR currency', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'bkg-eur',
        totalAmountUsd: new Prisma.Decimal('108.00'),
        paidAmountUsd: new Prisma.Decimal('0.00'),
        currency: 'EUR',
        originalAmount: new Prisma.Decimal('100.00'),
        status: 'PENDING',
      },
    ]);

    const result = await adminService.recordManualBookingPayment(
      'BKG-EUR-1',
      { amount: 100.0, method: 'BANK_TRANSFER', currency: 'EUR' },
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONFIRMED');
    expect(result.newPaidAmount).toBe('100.00');
    expect(result.balanceDue).toBe('0.00');
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: 'EUR',
          amount: new Prisma.Decimal('100.00'),
        }),
      }),
    );
  });

  it('rejects client manual payment when submitted currency mismatches booking currency', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'bkg-eur',
        totalAmountUsd: new Prisma.Decimal('108.00'),
        paidAmountUsd: new Prisma.Decimal('0.00'),
        currency: 'EUR',
        originalAmount: new Prisma.Decimal('100.00'),
        status: 'PENDING',
      },
    ]);

    await expect(
      adminService.recordManualBookingPayment(
        'BKG-EUR-1',
        { amount: 100.0, currency: 'USD' },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects manual payment when amount exceeds outstanding booking total', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'bkg-eur',
        totalAmountUsd: new Prisma.Decimal('108.00'),
        paidAmountUsd: new Prisma.Decimal('50.00'),
        currency: 'EUR',
        originalAmount: new Prisma.Decimal('100.00'),
        status: 'PARTIALLY_PAID',
      },
    ]);

    await expect(
      adminService.recordManualBookingPayment(
        'BKG-EUR-1',
        { amount: 60.0, currency: 'EUR' },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
