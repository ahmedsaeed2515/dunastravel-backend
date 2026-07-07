import { Test, TestingModule } from '@nestjs/testing';
import {
  UnprocessableEntityException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToursService } from '../tours/tours.service';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTour = {
    id: 'tour-123',
    slug: 'test-tour',
    titleJsonb: { en: 'Test Tour' },
    basePriceUsd: new Prisma.Decimal(100),
  };

  const baseDto = {
    tourId: 'tour-123',
    arrivalDate: '2027-06-15',
    adults: 2,
    children: 1,
    infants: 0,
    passengerNames: [
      { passengerType: 'ADULT', fullName: 'John Doe' },
      { passengerType: 'ADULT', fullName: 'Jane Doe' },
      { passengerType: 'CHILD', fullName: 'Jimmy Doe' },
    ],
    billing: {
      fullName: 'John Doe',
      email: 'john@test.com',
      phone: '123456789',
      invoiceType: 'PERSONAL',
    },
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
    totalAmountUsd: new Prisma.Decimal(275),
  };

  let mockTx: any;

  beforeEach(async () => {
    let seq = 0n;
    mockTx = {
      booking: { create: jest.fn().mockResolvedValue(mockBookingResult), update: jest.fn().mockResolvedValue(mockBookingResult) },
      tour: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      passenger: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      billingInfo: { create: jest.fn().mockResolvedValue(baseDto.billing) },
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
          provide: PrismaService,
          useValue: {
            tour: { findFirst: jest.fn().mockResolvedValue(mockTour) },
            booking: {
              findUnique: jest.fn().mockResolvedValue(null),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(1),
            },
            $transaction: jest.fn((arg: any) => {
              if (Array.isArray(arg)) {
                return Promise.all(arg);
              }
              return arg(mockTx);
            }),
          },
        },
        { provide: ToursService, useValue: {} },
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
    prisma = module.get(PrismaService);

    jest
      .spyOn(service as any, 'generateUniqueReferenceCode')
      .mockResolvedValue('BKG-ABC123');
  });

  afterEach(() => jest.clearAllMocks());

  // ?? Price Calculation ??????????????????????????????????????????????????????

  describe('calculateTotalAmount', () => {
    it('2 adults at $100 = $200', () => {
      const r = (service as any).calculateTotalAmount(
        new Prisma.Decimal(100),
        2,
        0,
      );
      expect(r.toString()).toBe('200');
    });

    it('1 child at 75% of $100 = $75', () => {
      const r = (service as any).calculateTotalAmount(
        new Prisma.Decimal(100),
        0,
        1,
      );
      expect(r.toString()).toBe('75');
    });

    it('2 adults + 1 child at $100 = $275', () => {
      const r = (service as any).calculateTotalAmount(
        new Prisma.Decimal(100),
        2,
        1,
      );
      expect(r.toString()).toBe('275');
    });
  });

  // ?? createBooking ??????????????????????????????????????????????????????????

  describe('createBooking', () => {
    it('should return valid booking structure', async () => {
      const result = await service.createBooking(baseDto, 'user-1');
      expect(result.referenceCode).toBe('BKG-ABC123');
      expect(result.status).toBe('PENDING');
    });

    it('should handle concurrent booking requests without duplicate invoice numbers', async () => {
      const promises = Array.from({ length: 5 }, () =>
        service.createBooking(baseDto as any, 'user-1'),
      );
      const results = await Promise.all(promises);
      const invoiceNumbers = results.map((r) => r.invoiceNumber);
      const uniqueInvoices = new Set(invoiceNumbers);
      expect(uniqueInvoices.size).toBe(5);
      expect(invoiceNumbers).toContain(`INV-${new Date().getFullYear()}-0001`);
      expect(invoiceNumbers).toContain(`INV-${new Date().getFullYear()}-0005`);
    });

    it('should always recalculate total server-side (ignores client)', async () => {
      await service.createBooking(baseDto, null);
      const data = mockTx.booking.create.mock.calls[0][0].data;
      expect(data.totalAmountUsd.toString()).toBe('275');
    });

    it('should support guest checkout (userId=null)', async () => {
      await service.createBooking(baseDto, null);
      const data = mockTx.booking.create.mock.calls[0][0].data;
      expect(data.userId).toBeNull();
    });

    it('should throw UnprocessableEntityException when tour missing', async () => {
      (prisma.tour.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createBooking(baseDto as any, 'user-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw BadRequestException when COMPANY invoiceType but no companyName', async () => {
      const dto = {
        ...baseDto,
        billing: {
          ...baseDto.billing,
          invoiceType: 'COMPANY',
          companyName: '',
        },
      };
      await expect(service.createBooking(dto as any, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException after 3 P2002 invoice collisions', async () => {
      const p2002 = Object.assign(new Error('unique'), {
        code: 'P2002',
        meta: { target: ['invoiceNumber'] },
      });
      (prisma['$transaction'] as jest.Mock).mockRejectedValue(p2002);
      await expect(
        service.createBooking(baseDto as any, 'user-1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ?? findByReferenceCode ????????????????????????????????????????????????????

  describe('findByReferenceCode', () => {
    const mockBooking = {
      id: 'booking-1',
      referenceCode: 'BKG-ABC123',
      userId: 'user-1',
      status: 'PENDING',
      arrivalDate: new Date('2027-06-15'),
      departureDate: null,
      adults: 2,
      children: 1,
      infants: 0,
      totalAmountUsd: new Prisma.Decimal(275),
      createdAt: new Date(),
      tour: { titleJsonb: { en: 'Test Tour' }, slug: 'test-tour' },
      invoice: { invoiceNumber: 'INV-2027-0001' },
      billingInfo: { email: 'john@test.com' },
    };

    beforeEach(() => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);
    });

    it('should allow owner access by userId', async () => {
      const r = await service.findByReferenceCode(
        'BKG-ABC123',
        undefined,
        'user-1',
      );
      expect(r.referenceCode).toBe('BKG-ABC123');
    });

    it('should allow guest access by matching email', async () => {
      const r = await service.findByReferenceCode(
        'BKG-ABC123',
        'john@test.com',
      );
      expect(r.referenceCode).toBe('BKG-ABC123');
    });

    it('should be case-insensitive on email', async () => {
      const r = await service.findByReferenceCode(
        'BKG-ABC123',
        'JOHN@TEST.COM',
      );
      expect(r.referenceCode).toBe('BKG-ABC123');
    });

    it('should throw NotFoundException when no credentials match (IDOR protection)', async () => {
      await expect(
        service.findByReferenceCode(
          'BKG-ABC123',
          'hacker@evil.com',
          'other-user',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no credentials provided', async () => {
      await expect(service.findByReferenceCode('BKG-ABC123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when booking does not exist', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.findByReferenceCode('BKG-ZZZZZZ', 'x@x.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findUserBookings', () => {
    it('should return user bookings', async () => {
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'booking-1',
          referenceCode: 'BKG-ABC123',
          userId: 'user-1',
          status: 'PENDING',
          arrivalDate: new Date('2027-06-15'),
          departureDate: null,
          adults: 2,
          children: 1,
          infants: 0,
          totalAmountUsd: new Prisma.Decimal(275),
          createdAt: new Date(),
          tour: { titleJsonb: { en: 'Test Tour' }, slug: 'test-tour' },
          invoice: { invoiceNumber: 'INV-2027-0001' },
        },
      ]);
      const r = await service.findUserBookings('user-1');
      expect(r.items).toHaveLength(1);
      expect(r.items[0].referenceCode).toBe('BKG-ABC123');
    });
  });

  // ─── cancelBooking ──────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    const mockBooking = {
      id: 'booking-1',
      referenceCode: 'BKG-ABC123',
      userId: 'user-1',
      status: 'PENDING',
      adults: 2,
      children: 1,
      tourId: 'tour-123',
      billingInfo: { email: 'john@test.com' },
    };

    it('should successfully cancel booking for the owner', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.cancelBooking('BKG-ABC123', 'user-1', 'Reason');

      expect(result.message).toBe('Booking cancelled successfully');
      expect(prisma['$transaction']).toHaveBeenCalled();
    });

    it('should reject cancellation by non-owner (IDOR)', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue(mockBooking);

      await expect(
        service.cancelBooking('BKG-ABC123', 'other-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking is already cancelled', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        ...mockBooking,
        status: 'CANCELLED',
      });

      await expect(
        service.cancelBooking('BKG-ABC123', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
