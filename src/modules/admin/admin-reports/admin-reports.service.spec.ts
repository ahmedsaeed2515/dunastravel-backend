import { AdminReportsService } from './admin-reports.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminReportsService', () => {
  let service: AdminReportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      tour: {
        findMany: jest.fn(),
      },
    };
    service = new AdminReportsService(prisma);
  });

  describe('getBookingsTrend', () => {
    it('executes time-series SQL grouping on bookings created_at and maps rows', async () => {
      const mockRows = [
        {
          period: new Date('2026-01-01T00:00:00Z'),
          total: BigInt(15),
          confirmed: BigInt(10),
          pending: BigInt(3),
          completed: BigInt(1),
          cancelled: BigInt(1),
        },
        {
          period: new Date('2026-02-01T00:00:00Z'),
          total: BigInt(22),
          confirmed: BigInt(18),
          pending: BigInt(2),
          completed: BigInt(1),
          cancelled: BigInt(1),
        },
      ];
      prisma.$queryRaw.mockResolvedValueOnce(mockRows);

      const result = await service.getBookingsTrend('monthly');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: '2026-01-01T00:00:00.000Z',
        total: 15,
        confirmed: 10,
        pending: 3,
        completed: 1,
        cancelled: 1,
      });
      expect(result[1].total).toBe(22);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('getRevenueTrend', () => {
    it('executes time-series SQL grouping on payments and refunds and maps financial metrics', async () => {
      const mockRows = [
        {
          period: new Date('2026-01-01T00:00:00Z'),
          grossRevenue: 25000,
          collectedRevenue: 24500,
          bookingsCount: BigInt(12),
        },
      ];
      prisma.$queryRaw.mockResolvedValueOnce(mockRows);

      const result = await service.getRevenueTrend('weekly');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        period: '2026-01-01T00:00:00.000Z',
        grossRevenue: 25000,
        totalRevenue: 24500,
        collectedRevenue: 24500,
        bookingsCount: 12,
        currency: 'USD',
      });
    });
  });

  describe('getDestinationsReport', () => {
    it('aggregates real tours, counts tours and ignores blank destinations', async () => {
      prisma.tour.findMany.mockResolvedValueOnce([
        { city: 'Cairo', country: 'Egypt', _count: { bookings: 3 } },
        { city: 'Cairo', country: 'Egypt', _count: { bookings: 2 } },
        { city: null, country: 'Turkey', _count: { bookings: 1 } },
        { city: '  ', country: null, _count: { bookings: 9 } },
      ]);

      const result = await service.getDestinationsReport();

      expect(result).toEqual([
        {
          location: 'Cairo, Egypt',
          country: 'Egypt',
          city: 'Cairo',
          bookingCount: 5,
          tourCount: 2,
        },
        {
          location: 'Turkey',
          country: 'Turkey',
          city: null,
          bookingCount: 1,
          tourCount: 1,
        },
      ]);
    });
  });
});
