import { Test, TestingModule } from '@nestjs/testing';
import {
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService, IdempotencyCacheEnvelope } from './bookings.service';
import { PricingService } from '../pricing/pricing.service';
import { AvailabilityService } from '../availability/availability.service';
import { ToursService } from '../tours/tours.service';
import { CommissionsService } from '../commissions/commissions.service';
import { PrismaService } from '../../prisma/prisma.service';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

describe('Revenue Workflow & Concurrency Service Unit Tests', () => {
  let bookingsService: BookingsService;
  let availabilityService: AvailabilityService;

  const TEST_GUEST_SECRET =
    'super-secret-guest-token-key-that-is-at-least-32-chars-long';

  interface MockTxType {
    booking: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    bookingActivityLog: { create: jest.Mock };
    tour: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    tourAvailability: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    promotion: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    promotionRedemption: {
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    passenger: { createMany: jest.Mock; findMany: jest.Mock };
    billingInfo: { create: jest.Mock };
    invoice: { create: jest.Mock };
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
  }

  let mockPrisma: {
    booking: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    tour: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let mockTx: MockTxType;
  let mockCacheManager: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    mockTx = {
      booking: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      bookingActivityLog: {
        create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      },
      tour: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      tourAvailability: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      promotion: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      promotionRedemption: {
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      passenger: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      billingInfo: {
        create: jest.fn().mockResolvedValue({
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+123',
          invoiceType: 'PERSONAL',
          companyName: null,
          taxId: null,
          address: null,
          city: null,
          country: null,
        }),
      },
      invoice: { create: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: 1 }]),
    };

    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      tour: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: MockTxType) => Promise<unknown>) =>
        cb(mockTx),
      ),
    };

    mockCacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
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
          provide: PricingService,
          useValue: {
            calculatePrice: jest.fn().mockResolvedValue({
              basePriceUsd: '100.00',
              adultTotalUsd: '200.00',
              childTotalUsd: '0.00',
              seasonalAdjustmentUsd: '0.00',
              discountAmountUsd: '0.00',
              totalAmountUsd: '200.00',
              currency: 'USD',
              promoValid: true,
              promoMessage: null,
              discounts: [],
            }),
          },
        },
        AvailabilityService,
        { provide: ToursService, useValue: {} },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        {
          provide: CommissionsService,
          useValue: {
            createCommissionForBooking: jest.fn().mockResolvedValue(null),
            reverseCommissionForBooking: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getToken('bookings_created_total'),
          useValue: { inc: jest.fn() },
        },
      ],
    }).compile();

    bookingsService = module.get<BookingsService>(BookingsService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
  });

  describe('Capacity Ordering & Low Capacity Bookings', () => {
    it('Booking can purchase the exact last remaining seats without pricing false rejection', async () => {
      const tour = {
        id: 'tour-1',
        slug: 'lux-tour',
        basePriceUsd: new Prisma.Decimal(100),
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
        titleJsonb: { en: 'Lux Tour' },
      };
      mockTx.tour.findUnique.mockResolvedValue(tour);
      mockTx.tour.findFirst.mockResolvedValue(tour);

      const availability = {
        id: 'avail-1',
        tourId: 'tour-1',
        date: new Date('2027-09-01'),
        remainingSeats: 2,
        totalCapacity: 10,
        status: 'AVAILABLE',
      };
      mockTx.tourAvailability.findUnique.mockResolvedValue(availability);

      mockTx.booking.create.mockResolvedValue({
        id: 'bkg-last-seats',
        referenceCode: 'DUN-1001',
        totalAmountUsd: new Prisma.Decimal(200),
        arrivalDate: new Date('2027-09-01'),
        passengers: [],
        billingInfo: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+123',
          invoiceType: 'PERSONAL',
        },
      });
      mockTx.invoice.create.mockResolvedValue({
        invoiceNumber: 'INV-2027-0001',
      });

      const dto = {
        type: 'booking' as const,
        tourId: 'tour-1',
        availabilityId: 'avail-1',
        arrivalDate: '2027-09-01',
        adults: 2,
        children: 0,
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123',
        nationality: 'American',
      };

      const res = await bookingsService.createBooking(
        dto,
        'user-1',
        'last-seats-request-1',
      );
      expect(res).toBeDefined();
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('Capacity release uses atomic SQL update', async () => {
      await availabilityService.releaseCapacity(
        mockTx as unknown as Prisma.TransactionClient,
        'avail-1',
        5,
      );
      expect(mockTx.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('Durable Payload-Aware Idempotency & Typed Envelope', () => {
    it('Same idempotency key + same actor + same payload replays response from envelope', async () => {
      const dto = {
        type: 'booking' as const,
        tourId: 'tour-1',
        arrivalDate: '2027-09-01',
        adults: 2,
        children: 0,
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123',
        nationality: 'American',
      };

      const serviceWithPrivate = bookingsService as unknown as {
        computeRequestHash: (d: typeof dto, u?: string) => string;
      };
      const hash = serviceWithPrivate.computeRequestHash(dto, 'usr-1');
      const mockResponse = {
        id: 'bkg-idem-1',
        referenceCode: 'DUN-1001',
        invoiceNumber: 'INV-2027-0001',
        status: 'PENDING',
        tourTitle: 'Lux Tour',
        arrivalDate: '2027-09-01',
        departureDate: null,
        adults: 2,
        children: 0,
        infants: 0,
        totalAmountUsd: '200.00',
        passengers: [],
        billing: {
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+123',
          invoiceType: 'PERSONAL',
        },
        guestToken: null,
      };

      const envelope: IdempotencyCacheEnvelope = {
        version: 1,
        userId: 'usr-1',
        requestHash: hash,
        bookingId: 'bkg-idem-1',
        referenceCode: 'DUN-1001',
        responsePayload: mockResponse,
      };

      mockCacheManager.get.mockResolvedValue(envelope);

      const res = await bookingsService.createBooking(
        dto,
        'usr-1',
        'idem-key-1',
      );
      expect(res.id).toBe('bkg-idem-1');
    });

    it('Same idempotency key + different user rejects with 422 Unprocessable Entity', async () => {
      const dto = {
        type: 'booking' as const,
        tourId: 'tour-1',
        arrivalDate: '2027-09-01',
        adults: 2,
        children: 0,
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123',
        nationality: 'American',
      };

      const envelope: IdempotencyCacheEnvelope = {
        version: 1,
        userId: 'different-user',
        requestHash: 'hash',
        bookingId: 'bkg-1',
        referenceCode: 'DUN-1',
        responsePayload: {
          id: 'bkg-1',
          referenceCode: 'DUN-1',
          invoiceNumber: 'INV-1',
          status: 'PENDING',
          tourTitle: 'Lux Tour',
          arrivalDate: '2027-09-01',
          departureDate: null,
          adults: 2,
          children: 0,
          infants: 0,
          totalAmountUsd: '200.00',
          passengers: [],
          billing: {
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            phone: '+123',
            invoiceType: 'PERSONAL',
          },
        },
      };

      mockCacheManager.get.mockResolvedValue(envelope);

      await expect(
        bookingsService.createBooking(dto, 'usr-1', 'idem-key-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('Same idempotency key + different payload rejects with 422 Unprocessable Entity', async () => {
      const dto = {
        type: 'booking' as const,
        tourId: 'tour-1',
        arrivalDate: '2027-09-01',
        adults: 5,
        children: 0,
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123',
        nationality: 'American',
      };

      const envelope: IdempotencyCacheEnvelope = {
        version: 1,
        userId: 'usr-1',
        requestHash: 'different-hash',
        bookingId: 'bkg-1',
        referenceCode: 'DUN-1',
        responsePayload: {
          id: 'bkg-1',
          referenceCode: 'DUN-1',
          invoiceNumber: 'INV-1',
          status: 'PENDING',
          tourTitle: 'Lux Tour',
          arrivalDate: '2027-09-01',
          departureDate: null,
          adults: 5,
          children: 0,
          infants: 0,
          totalAmountUsd: '500.00',
          passengers: [],
          billing: {
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            phone: '+123',
            invoiceType: 'PERSONAL',
          },
        },
      };

      mockCacheManager.get.mockResolvedValue(envelope);

      await expect(
        bookingsService.createBooking(dto, 'usr-1', 'idem-key-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('Guest Security & Cancellation IDOR Protection', () => {
    it('Guest booking cannot be cancelled by arbitrary authenticated user without guest token', async () => {
      const booking = {
        id: 'bkg-guest',
        referenceCode: 'DUN-GUEST',
        userId: null,
        guestTokenHash: 'valid-hash',
        status: 'PENDING',
        adults: 2,
        children: 0,
      };
      mockPrisma.booking.findFirst.mockResolvedValue(booking);

      await expect(
        bookingsService.cancelBooking(
          'DUN-GUEST',
          'random-user-id',
          'Change of plans',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Valid guest token cancels guest booking and reverses promo once', async () => {
      const guestToken = 'secret-guest-token-123';
      const guestTokenHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');

      const booking = {
        id: 'bkg-guest',
        referenceCode: 'DUN-GUEST',
        userId: null,
        guestTokenHash,
        status: 'PENDING',
        adults: 2,
        children: 0,
        availabilityId: 'avail-1',
        promotionRedemption: {
          id: 'red-1',
          promotionId: 'promo-1',
          status: 'ACTIVE',
        },
      };
      mockPrisma.booking.findFirst.mockResolvedValue(booking);
      mockTx.booking.updateMany.mockResolvedValue({ count: 1 });
      mockTx.promotionRedemption.updateMany.mockResolvedValue({ count: 1 });
      mockTx.promotion.updateMany.mockResolvedValue({ count: 1 });

      const res = await bookingsService.cancelBooking(
        'DUN-GUEST',
        undefined,
        'User cancel',
        guestToken,
      );
      expect(res).toEqual({ message: 'Booking cancelled successfully' });
    });
  });
});
