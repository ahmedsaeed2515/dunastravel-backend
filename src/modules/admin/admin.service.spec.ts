import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AdminService', () => {
  let service: AdminService;
  let bookingsServiceMock: any;
  let prisma: {
    $transaction: jest.Mock;
    booking: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    bookingActivityLog: {
      createMany: jest.Mock;
      create: jest.Mock;
    };
    tailorMadeInquiry: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    contactSubmission: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    notificationDeliveryLog: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    bookingsServiceMock = {
      transitionBookingStatus: jest
        .fn()
        .mockResolvedValue({ id: 'b1', status: 'CANCELLED' }),
      createBooking: jest.fn(),
    };

    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: any) => Promise<any>) => cb(prisma)),
      booking: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'b1' }),
      },
      bookingActivityLog: {
        createMany: jest.fn(),
        create: jest.fn(),
      },
      tailorMadeInquiry: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      contactSubmission: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      notificationDeliveryLog: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: BookingsService,
          useValue: bookingsServiceMock,
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate metrics properly when zero bookings exist', async () => {
      prisma.booking.count.mockResolvedValue(0);
      prisma.tailorMadeInquiry.count.mockResolvedValue(0);
      prisma.contactSubmission.count.mockResolvedValue(0);
      prisma.notificationDeliveryLog.count.mockResolvedValue(0);

      const result = await service.getDashboardMetrics('admin-uuid');

      expect(result.totalBookings).toBe(0);
      expect(result.totalInquiries).toBe(0);
      expect(result.totalContactSubmissions).toBe(0);
    });
  });

  describe('listBookings', () => {
    it('returns pagination only in the canonical meta object', async () => {
      prisma.booking.count.mockResolvedValue(1);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'booking-1',
          referenceCode: 'BKG-A4X7Z2',
          status: 'PENDING',
          totalAmountUsd: { toString: () => '0.00' },
          createdAt: new Date('2026-08-01T00:00:00Z'),
          _count: { passengers: 0 },
          invoice: null,
          tour: { id: 'tour-1', slug: 'nile', titleJsonb: { en: 'Nile' } },
        },
      ]);

      const result = await service.listBookings({ page: 1, limit: 20 }, 'admin-1');

      expect(result).toEqual({
        data: [expect.objectContaining({ totalAmount: '0.00', passengerCount: 0 })],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      expect('total' in result).toBe(false);
    });
  });

  describe('listInquiries', () => {
    it('searches real inquiry fields and returns assignment state', async () => {
      prisma.tailorMadeInquiry.count.mockResolvedValue(1);
      prisma.tailorMadeInquiry.findMany.mockResolvedValue([
        {
          id: 'inquiry-1',
          referenceCode: 'INQ-2026-0001',
          status: 'IN_PROGRESS',
          fullName: 'Ahmed Saeed',
          email: 'ahmed@example.com',
          phone: '+201000000000',
          adults: 2,
          children: 1,
          assigneeId: 'agent-1',
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
      ]);

      const result = await service.listInquiries(
        { search: 'Ahmed', page: 1, limit: 20 },
        'admin-1',
      );

      expect(prisma.tailorMadeInquiry.count).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { fullName: { contains: 'Ahmed', mode: 'insensitive' } },
          ]),
        },
      });
      expect(result.data[0]).toMatchObject({
        firstName: 'Ahmed',
        lastName: 'Saeed',
        numberOfTravelers: 3,
        assigneeId: 'agent-1',
      });
    });
  });

  describe('bulkUpdateBookings', () => {
    it('should update multiple bookings and log activity', async () => {
      const dto = {
        referenceCodes: ['BKG-1', 'BKG-2'],
        priority: 'HIGH',
      };

      prisma.booking.updateMany.mockResolvedValue({ count: 2 });
      prisma.booking.findMany.mockResolvedValue([
        { id: 'uuid-1' },
        { id: 'uuid-2' },
      ]);

      const result = await service.bulkUpdateBookings(dto, 'admin-uuid');

      expect(result.count).toBe(2);
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: {
          referenceCode: { in: dto.referenceCodes },
          deletedAt: null,
        },
        data: { priority: 'HIGH' },
      });
      expect(prisma.bookingActivityLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            bookingId: 'uuid-1',
            userId: 'admin-uuid',
            action: 'BULK_UPDATE',
            details: { changedFields: ['priority'] },
          },
          {
            bookingId: 'uuid-2',
            userId: 'admin-uuid',
            action: 'BULK_UPDATE',
            details: { changedFields: ['priority'] },
          },
        ],
      });
    });

    it('should handle partial failure gracefully if updateMany succeeds but some records not found', async () => {
      const dto = {
        referenceCodes: ['BKG-1', 'BKG-MISSING'],
        priority: 'URGENT',
      };

      prisma.booking.updateMany.mockResolvedValue({ count: 1 });
      prisma.booking.findMany.mockResolvedValue([{ id: 'uuid-1' }]);

      const result = await service.bulkUpdateBookings(dto, 'admin-uuid');

      expect(result.count).toBe(1);
      expect(prisma.bookingActivityLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            bookingId: 'uuid-1',
            userId: 'admin-uuid',
            action: 'BULK_UPDATE',
            details: { changedFields: ['priority'] },
          },
        ],
      });
    });

    it('should return count 0 if empty data object provided', async () => {
      const result = await service.bulkUpdateBookings(
        { referenceCodes: ['BKG-1'] },
        'admin-uuid',
      );
      expect(result.count).toBe(0);
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteBooking and restoreBooking', () => {
    it('should soft delete and cascade log', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'uuid-1',
        referenceCode: 'BKG-1',
      });

      await service.softDeleteBooking('BKG-1', 'admin-uuid');

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { referenceCode: 'BKG-1' },
        }),
      );
      expect(prisma.bookingActivityLog.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'uuid-1',
          userId: 'admin-uuid',
          action: 'BOOKING_DELETED',
          details: { softDelete: true },
        },
      });
    });

    it('should throw NotFoundException if booking to delete not found', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.softDeleteBooking('MISSING', 'admin-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should restore booking and log', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'uuid-1',
        deletedAt: new Date(),
        status: 'CANCELLED',
      });
      await service.restoreBooking('BKG-1', 'admin-uuid');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { referenceCode: 'BKG-1' },
        data: { deletedAt: null },
      });
      expect(bookingsServiceMock.transitionBookingStatus).toHaveBeenCalledWith(
        'BKG-1',
        'CONFIRMED',
        { id: 'admin-uuid', role: 'ADMIN' },
        'Restored by admin',
      );
    });
  });
});
