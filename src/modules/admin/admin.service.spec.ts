import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
            booking: {
              count: jest.fn().mockResolvedValue(0),
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              updateMany: jest.fn(),
              update: jest.fn(),
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
          },
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
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate metrics properly when zero bookings exist', async () => {
      // Mock counts to 0
      jest.spyOn(prisma.booking, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.tailorMadeInquiry, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.contactSubmission, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.notificationDeliveryLog, 'count').mockResolvedValue(0);

      const result = await service.getDashboardMetrics('admin-uuid');
      
      expect(result.totalBookings).toBe(0);
      expect(result.totalInquiries).toBe(0);
      expect(result.totalContactSubmissions).toBe(0);
      // expect(result.recentFailedNotifications).toBe(0);
    });
  });

  describe('bulkUpdateBookings', () => {
    it('should update multiple bookings and log activity', async () => {
      const dto = {
        referenceCodes: ['BKG-1', 'BKG-2'],
        status: 'CONFIRMED' as any,
      };

      jest.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 2 } as any);
      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue([
        { id: 'uuid-1' },
        { id: 'uuid-2' },
      ] as any);

      const result = await service.bulkUpdateBookings(dto, 'admin-uuid');
      
      expect(result.count).toBe(2);
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { referenceCode: { in: dto.referenceCodes } },
        data: { status: 'CONFIRMED' }
      });
      expect(prisma.bookingActivityLog.createMany).toHaveBeenCalledWith({
        data: [
          { bookingId: 'uuid-1', userId: 'admin-uuid', action: 'BULK_UPDATE', details: { status: 'CONFIRMED' } },
          { bookingId: 'uuid-2', userId: 'admin-uuid', action: 'BULK_UPDATE', details: { status: 'CONFIRMED' } }
        ]
      });
    });

    it('should handle partial failure gracefully if updateMany succeeds but some records not found', async () => {
      const dto = { referenceCodes: ['BKG-1', 'BKG-MISSING'], status: 'CANCELLED' as any };
      
      jest.spyOn(prisma.booking, 'updateMany').mockResolvedValue({ count: 1 } as any);
      // Only 1 is returned
      jest.spyOn(prisma.booking, 'findMany').mockResolvedValue([{ id: 'uuid-1' }] as any);

      const result = await service.bulkUpdateBookings(dto, 'admin-uuid');
      
      expect(result.count).toBe(1);
      // Ensure logs are only created for the found booking
      expect(prisma.bookingActivityLog.createMany).toHaveBeenCalledWith({
        data: [
          { bookingId: 'uuid-1', userId: 'admin-uuid', action: 'BULK_UPDATE', details: { status: 'CANCELLED' } }
        ]
      });
    });
    
    it('should return count 0 if empty data object provided', async () => {
      const result = await service.bulkUpdateBookings({ referenceCodes: ['BKG-1'] }, 'admin-uuid');
      expect(result.count).toBe(0);
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteBooking and restoreBooking', () => {
    it('should soft delete and cascade log', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({ id: 'uuid-1', referenceCode: 'BKG-1' } as any);
      
      await service.softDeleteBooking('BKG-1', 'admin-uuid');
      
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { referenceCode: 'BKG-1' },
        data: { deletedAt: expect.any(Date) }
      });
      expect(prisma.bookingActivityLog.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'uuid-1',
          userId: 'admin-uuid',
          action: 'BOOKING_DELETED',
          details: { softDelete: true }
        }
      });
    });

    it('should throw NotFoundException if booking to delete not found', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);
      await expect(service.softDeleteBooking('MISSING', 'admin-uuid')).rejects.toThrow(NotFoundException);
    });
    
    it('should restore booking and log', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({ id: 'uuid-1' } as any);
      await service.restoreBooking('BKG-1', 'admin-uuid');
      
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { referenceCode: 'BKG-1' },
        data: { deletedAt: null }
      });
    });
  });
});
