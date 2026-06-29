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
            booking: {
              count: jest.fn().mockResolvedValue(0),
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics', async () => {
      const result = await service.getDashboardMetrics(1 as any);
      expect(result).toHaveProperty('totalBookings');
      expect(result).toHaveProperty('totalInquiries');
      expect(result).toHaveProperty('totalContactSubmissions');
      expect(result).toHaveProperty('recentFailedNotifications');
    });
  });

  describe('getBookingByReferenceCode', () => {
    it('should throw NotFoundException if booking not found', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);
      await expect(
        service.getBookingByReferenceCode('BKG-123456', 'uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
