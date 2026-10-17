import { Test, TestingModule } from '@nestjs/testing';
import {
  UnprocessableEntityException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToursService } from '../tours/tours.service';
import { PricingService } from '../pricing/pricing.service';
import { AvailabilityService } from '../availability/availability.service';
import { CommissionsService } from '../commissions/commissions.service';
import { getToken } from '@willsoto/nestjs-prometheus';

import * as crypto from 'crypto';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;

  const TEST_GUEST_SECRET =
    'super-secret-guest-token-key-that-is-at-least-32-chars-long';

  const mockTour = {
    id: 'tour-123',
    slug: 'test-tour',
    titleJsonb: { en: 'Test Tour' },
    basePriceUsd: new Prisma.Decimal(100),
    status: 'PUBLISHED',
    isActive: true,
    deletedAt: null,
    currency: 'USD',
  };

  const baseDto = {
    type: 'booking' as const,
    tourId: 'tour-123',
    arrivalDate: '2027-06-15',
    adults: 2,
    children: 1,
    infants: 0,
    fullName: 'John Doe',
    email: 'john@test.com',
    phone: '123456789',
    passengerNames: {
      adult_0: 'John Doe',
      adult_1: 'Jane Doe',
      child_0: 'Jimmy Doe',
    },
    nationality: 'American',
    invoiceType: 'PERSONAL',
  };

  const mockBookingResult = {
    id: 'booking-1',
    referenceCode: 'BKG-ABC123',
    status: 'PENDING',
    arrivalDate: new Date('2027-06-15'),
    departureDate: null,
    adults: 2,
    children: 1,
    infants: 0,
    totalAmountUsd: new Prisma.Decimal(250),
  };

  interface MockTxType {
    tour: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    booking: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    bookingActivityLog: {
      create: jest.Mock;
    };
    tourAvailability: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    promotion: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    promotionRedemption: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passenger: {
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
    billingInfo: {
      create: jest.Mock;
    };
    invoice: {
      create: jest.Mock;
    };
    $queryRaw: jest.Mock;
  }

  let mockTx: MockTxType;

  beforeEach(async () => {
    let seq = 0n;
    mockTx = {
      tour: {
        findUnique: jest.fn().mockResolvedValue(mockTour),
        findFirst: jest.fn().mockResolvedValue(mockTour),
      },
      booking: {
        create: jest.fn().mockResolvedValue(mockBookingResult),
        update: jest.fn().mockResolvedValue(mockBookingResult),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingActivityLog: {
        create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      },
      tourAvailability: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'avail-123',
          tourId: 'tour-123',
          date: new Date('2027-06-15'),
          remainingSeats: 10,
          status: 'AVAILABLE',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'avail-123',
          tourId: 'tour-123',
          date: new Date('2027-06-15'),
          remainingSeats: 10,
          status: 'AVAILABLE',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'avail-123', remainingSeats: 10 }),
      },
      promotion: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promotionRedemption: {
        create: jest.fn().mockResolvedValue({ id: 'red-1' }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'red-1', status: 'REVERSED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      passenger: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      billingInfo: {
        create: jest.fn().mockResolvedValue({
          fullName: 'John Doe',
          email: 'john@test.com',
          phone: '123456789',
          invoiceType: 'PERSONAL',
        }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ invoiceNumber: 'INV-2027-0001' }),
      },
      $queryRaw: jest.fn().mockImplementation(() => {
        seq += 1n;
        return Promise.resolve([{ nextval: seq }]);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (
                key === 'GUEST_TOKEN_SECRET' ||
                key === 'auth.guestTokenSecret'
              ) {
                return TEST_GUEST_SECRET;
              }
              return null;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            tour: {
              findUnique: jest.fn().mockResolvedValue(mockTour),
              findFirst: jest.fn().mockResolvedValue(mockTour),
              findMany: jest.fn().mockResolvedValue([mockTour]),
            },
            booking: {
              findUnique: jest.fn().mockResolvedValue(null),
              findFirst: jest.fn().mockResolvedValue(null),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(1),
            },
            $transaction: jest.fn(
              (
                arg:
                  | ((tx: MockTxType) => Promise<unknown>)
                  | Array<Promise<unknown>>,
              ) => {
                if (Array.isArray(arg)) {
                  return Promise.all(arg);
                }
                return arg(mockTx);
              },
            ),
          },
        },
        { provide: ToursService, useValue: {} },
        {
          provide: PricingService,
          useValue: {
            calculatePrice: jest.fn().mockResolvedValue({
              basePriceUsd: '100.00',
              adultTotalUsd: '200.00',
              childTotalUsd: '50.00',
              seasonalAdjustmentUsd: '0.00',
              discountAmountUsd: '0.00',
              totalAmountUsd: '250.00',
              currency: 'USD',
              promoValid: true,
              promoMessage: null,
              discounts: [],
            }),
          },
        },
        {
          provide: AvailabilityService,
          useValue: {
            reserveCapacity: jest.fn().mockResolvedValue(undefined),
            releaseCapacity: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CommissionsService,
          useValue: {
            createCommissionForBooking: jest.fn().mockResolvedValue(null),
            reverseCommissionForBooking: jest.fn().mockResolvedValue(null),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: getToken('bookings_created_total'),
          useValue: { inc: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest
      .spyOn(service, 'generateUniqueReferenceCode')
      .mockResolvedValue('BKG-ABC123');
  });

  afterEach(() => jest.clearAllMocks());

  describe('calculateTotalAmount', () => {
    it('2 adults at $100 = $200', () => {
      const r = service.calculateTotalAmount(new Prisma.Decimal(100), 2, 0);
      expect(r.toString()).toBe('200');
    });

    it('1 child at 50% of $100 = $50 (P1-007 Blueprint Rule)', () => {
      const r = service.calculateTotalAmount(new Prisma.Decimal(100), 0, 1);
      expect(r.toString()).toBe('50');
    });

    it('2 adults + 1 child at $100 = $250', () => {
      const r = service.calculateTotalAmount(new Prisma.Decimal(100), 2, 1);
      expect(r.toString()).toBe('250');
    });
  });

  describe('createBooking', () => {
    it('should return valid booking structure', async () => {
      const result = await service.createBooking(
        baseDto,
        'user-1',
        'test-idem-1',
      );
      expect(result.referenceCode).toBe('BKG-ABC123');
      expect(result.status).toBe('PENDING');
    });

    it('should handle concurrent booking requests without duplicate invoice numbers', async () => {
      const promises = Array.from({ length: 5 }, (_, idx) =>
        service.createBooking(baseDto, 'user-1', `test-idem-concurrent-${idx}`),
      );
      const results = await Promise.all(promises);
      const invoiceNumbers = results.map((r) => r.invoiceNumber);
      const uniqueInvoices = new Set(invoiceNumbers);
      expect(uniqueInvoices.size).toBe(5);
      expect(invoiceNumbers[0]).toMatch(/^INV-\d{4}-0001/);
      expect(invoiceNumbers[4]).toMatch(/^INV-\d{4}-0005/);
    });

    it('should always recalculate total server-side (ignores client)', async () => {
      await service.createBooking(baseDto, 'user-1', 'test-idem-total');
      const firstCall = mockTx.booking.create.mock.calls[0] as Array<{
        data: { totalAmountUsd: Prisma.Decimal };
      }>;
      const createdData = firstCall[0].data;
      expect(createdData.totalAmountUsd.toString()).toBe('250');
    });

    it('should allow guest booking creation with null userId and guestToken', async () => {
      const result = await service.createBooking(
        baseDto,
        undefined,
        'test-idem-unauth',
      );
      expect(result.referenceCode).toBeDefined();
      expect(result.guestToken).toBeDefined();
      const firstCall = mockTx.booking.create.mock.calls[0] as Array<{
        data: { userId: string | null };
      }>;
      const createdData = firstCall[0].data;
      expect(createdData.userId).toBeNull();
    });

    it('should link new booking directly to authenticated userId', async () => {
      await service.createBooking(baseDto, 'user-1', 'test-idem-auth');
      const firstCall = mockTx.booking.create.mock.calls[0] as Array<{
        data: { userId: string | null };
      }>;
      const createdData = firstCall[0].data;
      expect(createdData.userId).toBe('user-1');
    });

    it('should throw UnprocessableEntityException when tour missing', async () => {
      mockTx.tour.findUnique.mockResolvedValue(null);
      mockTx.tour.findFirst.mockResolvedValue(null);
      await expect(
        service.createBooking(baseDto, 'user-1', 'test-idem-missing'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should handle COMPANY invoiceType', async () => {
      const dto = {
        ...baseDto,
        invoiceType: 'COMPANY',
        companyName: 'Acme Corp',
        taxId: 'TAX-123',
      };
      const result = await service.createBooking(
        dto,
        'user-1',
        'test-idem-company',
      );
      expect(result.status).toBe('PENDING');
    });

    it('should throw InternalServerErrorException after 3 P2002 invoice collisions', async () => {
      const p2002 = Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['idempotency_key'] },
      });
      jest.spyOn(prisma, '$transaction').mockRejectedValue(p2002);
      await expect(
        service.createBooking(baseDto, 'user-1', 'test-idem-p2002'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findByReferenceCode', () => {
    const guestTokenHash = crypto
      .createHmac('sha256', TEST_GUEST_SECRET)
      .update(`booking-1:BKG-ABC123`)
      .digest('hex');

    const mockBooking = {
      id: 'booking-1',
      referenceCode: 'BKG-ABC123',
      userId: 'user-1',
      guestTokenHash: crypto
        .createHash('sha256')
        .update(guestTokenHash)
        .digest('hex'),
      status: 'PENDING',
      arrivalDate: new Date('2027-06-15'),
      departureDate: null,
      adults: 2,
      children: 1,
      infants: 0,
      totalAmountUsd: new Prisma.Decimal(250),
      createdAt: new Date(),
      tour: { titleJsonb: { en: 'Test Tour' }, slug: 'test-tour' },
      invoice: { invoiceNumber: 'INV-2027-0001' },
      billingInfo: { email: 'john@test.com' },
    };

    beforeEach(() => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);
    });

    it('should allow owner access by userId', async () => {
      const r = await service.findByReferenceCode('BKG-ABC123', 'user-1');
      expect(r.referenceCode).toBe('BKG-ABC123');
    });

    it('should allow guest access with valid guestToken header', async () => {
      const r = await service.findByReferenceCode(
        'BKG-ABC123',
        undefined,
        guestTokenHash,
      );
      expect(r.referenceCode).toBe('BKG-ABC123');
    });

    it('should throw NotFoundException when guest token is invalid', async () => {
      await expect(
        service.findByReferenceCode('BKG-ABC123', undefined, 'invalid-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no credentials provided', async () => {
      await expect(service.findByReferenceCode('BKG-ABC123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.findByReferenceCode('BKG-ZZZZZZ', undefined, guestTokenHash),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelBooking', () => {
    const guestTokenHash = crypto
      .createHmac('sha256', TEST_GUEST_SECRET)
      .update(`booking-1:BKG-ABC123`)
      .digest('hex');

    const mockBooking = {
      id: 'booking-1',
      referenceCode: 'BKG-ABC123',
      userId: 'user-1',
      guestTokenHash: crypto
        .createHash('sha256')
        .update(guestTokenHash)
        .digest('hex'),
      status: 'PENDING',
      adults: 2,
      children: 1,
      tourId: 'tour-123',
      billingInfo: { email: 'john@test.com' },
    };

    it('should successfully cancel booking for the owner', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.cancelBooking(
        'BKG-ABC123',
        'user-1',
        'Reason',
      );

      expect(result.message).toBe('Booking cancelled successfully');
    });

    it('should successfully cancel booking with guestToken', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.cancelBooking(
        'BKG-ABC123',
        undefined,
        'Reason',
        guestTokenHash,
      );

      expect(result.message).toBe('Booking cancelled successfully');
    });

    it('should reject cancellation by non-owner without guestToken (IDOR)', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.cancelBooking('BKG-ABC123', 'other-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking is already cancelled', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });

      await expect(
        service.cancelBooking('BKG-ABC123', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assertBookingScheduleOpen (recurring booking rules)', () => {
    const invoke = (rules: unknown, arrivalDateStr: string) =>
      (service as any).assertBookingScheduleOpen(
        { bookingRulesJsonb: rules },
        arrivalDateStr,
      );

    it('does nothing when rules are missing or disabled', () => {
      expect(() => invoke(null, '2027-06-15')).not.toThrow();
      expect(() =>
        invoke(
          {
            enabled: false,
            blockedRanges: [{ start: '2027-01-01', end: '2027-12-31' }],
            blockedWeekdays: [0, 1, 2, 3, 4, 5, 6],
          },
          '2027-06-15',
        ),
      ).not.toThrow();
    });

    it('blocks bookings inside a fully blocked inclusive date range', () => {
      const rules = {
        enabled: true,
        blockedRanges: [
          { start: '2027-06-01', end: '2027-06-30', reason: 'Renovation' },
        ],
      };

      expect(() => invoke(rules, '2027-06-15')).toThrow(
        UnprocessableEntityException,
      );
      expect(() => invoke(rules, '2027-06-15')).toThrow(/BOOKINGS_CLOSED/);
      expect(() => invoke(rules, '2027-07-01')).not.toThrow();
    });

    it('treats blocked range boundaries as inclusive', () => {
      const rules = {
        enabled: true,
        blockedRanges: [{ start: '2027-06-10', end: '2027-06-20' }],
      };

      expect(() => invoke(rules, '2027-06-10')).toThrow(
        UnprocessableEntityException,
      );
      expect(() => invoke(rules, '2027-06-20')).toThrow(
        UnprocessableEntityException,
      );
      expect(() => invoke(rules, '2027-06-21')).not.toThrow();
    });

    it('blocks configured weekdays (evaluated in the tour timezone)', () => {
      const arrivalDate = '2027-06-15';
      const weekday = new Date(`${arrivalDate}T12:00:00Z`).getUTCDay();

      expect(() =>
        invoke(
          {
            enabled: true,
            cutoffTimezone: 'Africa/Cairo',
            blockedWeekdays: [weekday],
          },
          arrivalDate,
        ),
      ).toThrow(UnprocessableEntityException);

      expect(() =>
        invoke(
          {
            enabled: true,
            cutoffTimezone: 'Africa/Cairo',
            blockedWeekdays: [(weekday + 1) % 7],
          },
          arrivalDate,
        ),
      ).not.toThrow();
    });

    it('enforces the daily cutoff after the configured time in Africa/Cairo', () => {
      // 2027-01-10T10:00:00Z === 12:00 in Cairo (UTC+2 during winter, no DST).
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2027-01-10T10:00:00Z'));
      try {
        const arrivalDate = '2027-01-10';

        // 11:59 cutoff has already passed at 12:00 Cairo → blocked.
        expect(() =>
          invoke(
            {
              enabled: true,
              dailyCutoffTime: '11:59',
              cutoffTimezone: 'Africa/Cairo',
            },
            arrivalDate,
          ),
        ).toThrow(UnprocessableEntityException);

        // 12:01 cutoff has not passed yet → allowed.
        expect(() =>
          invoke(
            {
              enabled: true,
              dailyCutoffTime: '12:01',
              cutoffTimezone: 'Africa/Cairo',
            },
            arrivalDate,
          ),
        ).not.toThrow();

        // The cutoff only affects same-day departures.
        expect(() =>
          invoke(
            {
              enabled: true,
              dailyCutoffTime: '11:59',
              cutoffTimezone: 'Africa/Cairo',
            },
            '2027-01-11',
          ),
        ).not.toThrow();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
