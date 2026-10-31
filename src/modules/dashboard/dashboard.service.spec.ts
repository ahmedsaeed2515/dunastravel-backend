import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    prisma = {
      booking: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
      },
      refundRecord: {
        aggregate: jest.fn(),
      },
      tour: {
        count: jest.fn(),
      },
      tourAvailability: {
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      tailorMadeInquiry: {
        count: jest.fn(),
      },
      contactSubmission: {
        count: jest.fn(),
      },
      notificationDeliveryLog: {
        count: jest.fn(),
      },
      analyticsEvent: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getExecutiveSummary', () => {
    it('returns cached summary immediately if present in cache', async () => {
      const cachedData = { revenue: { grossRevenue: 50000 } };
      cacheManager.get.mockResolvedValueOnce(cachedData);

      const result: any = await service.getExecutiveSummary({});
      expect(result).toBe(cachedData);
      expect(prisma.booking.groupBy).not.toHaveBeenCalled();
    });

    it('calculates gross revenue, collected payments, outstanding balance, and changes correctly', async () => {
      // Current booking groups
      prisma.booking.groupBy.mockResolvedValueOnce([
        {
          status: 'CONFIRMED',
          _count: { _all: 10 },
          _sum: { totalAmountUsd: 10000, paidAmountUsd: 7000 },
        },
        {
          status: 'PAID',
          _count: { _all: 5 },
          _sum: { totalAmountUsd: 5000, paidAmountUsd: 5000 },
        },
        {
          status: 'PENDING',
          _count: { _all: 2 },
          _sum: { totalAmountUsd: 2000, paidAmountUsd: 0 },
        },
      ]);
      // Previous booking groups
      prisma.booking.groupBy.mockResolvedValueOnce([
        {
          status: 'CONFIRMED',
          _count: { _all: 8 },
          _sum: { totalAmountUsd: 8000, paidAmountUsd: 8000 },
        },
      ]);
      // Current pax aggregate
      prisma.booking.aggregate.mockResolvedValueOnce({
        _sum: { adults: 25, children: 5 },
      });
      // Payments current
      prisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { amount: 12000 },
      });
      // Payments prev
      prisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { amount: 8000 },
      });
      // Refunds current
      prisma.refundRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: 500 },
      });
      // Refunds prev
      prisma.refundRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: 200 },
      });
      // Active tours
      prisma.tour.count.mockResolvedValueOnce(18);
      // Total tours
      prisma.tour.count.mockResolvedValueOnce(25);
      // Capacity aggregate
      prisma.tourAvailability.aggregate.mockResolvedValueOnce({
        _sum: { totalCapacity: 200, remainingSeats: 150 },
      });
      // Open inquiries
      prisma.tailorMadeInquiry.count.mockResolvedValueOnce(4);
      // Unread contacts
      prisma.contactSubmission.count.mockResolvedValueOnce(2);
      // Delivery failures
      prisma.notificationDeliveryLog.count.mockResolvedValueOnce(1);
      // Visitor events (page/tour views)
      prisma.analyticsEvent.count.mockResolvedValueOnce(1000);
      // Booking started events
      prisma.analyticsEvent.count.mockResolvedValueOnce(50);
      // Active visitors group
      prisma.analyticsEvent.groupBy.mockResolvedValueOnce([
        { sessionId: 'sess-1' },
        { sessionId: 'sess-2' },
        { sessionId: 'sess-3' },
      ]);

      const result: any = await service.getExecutiveSummary({ preset: '30d' });

      expect(result.revenue.grossRevenue).toBe(15000); // Math.max(15000, 12000)
      expect(result.revenue.prevGrossRevenue).toBe(8000);
      expect(result.revenue.revenueChangePercent).toBe(87.5); // ((15000 - 8000) / 8000) * 100
      expect(result.revenue.collectedPayments).toBe(11500); // 12000 - 500
      expect(result.revenue.outstandingBalance).toBe(5000); // (10000-7000) + (2000-0) = 5000

      expect(result.bookings.total).toBe(17);
      expect(result.bookings.prevTotal).toBe(8);
      expect(result.bookings.byStatus.CONFIRMED).toBe(10);
      expect(result.bookings.byStatus.PAID).toBe(5);
      expect(result.bookings.byStatus.PENDING).toBe(2);

      expect(result.conversion.activeVisitors).toBe(3);
      expect(result.conversion.visitorViews).toBe(1000);
      expect(result.conversion.totalConversions).toBe(15); // 10 confirmed + 5 paid

      expect(result.capacity.totalCapacity).toBe(200);
      expect(result.capacity.seatsSold).toBe(50); // 200 - 150
      expect(result.capacity.occupancyRate).toBe(25); // (50 / 200) * 100

      expect(result.operational.activeToursCount).toBe(18);
      expect(result.operational.totalToursCount).toBe(25);
      expect(result.operational.openInquiriesCount).toBe(4);
      expect(result.operational.unreadContactsCount).toBe(2);
      expect(result.operational.failedNotificationsCount).toBe(1);

      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('safely handles zero / empty state without NaN or division by zero', async () => {
      prisma.booking.groupBy.mockResolvedValueOnce([]);
      prisma.booking.groupBy.mockResolvedValueOnce([]);
      prisma.booking.aggregate.mockResolvedValueOnce({
        _sum: { adults: null, children: null },
      });
      prisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });
      prisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });
      prisma.refundRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });
      prisma.refundRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });
      prisma.tour.count.mockResolvedValueOnce(0);
      prisma.tour.count.mockResolvedValueOnce(0);
      prisma.tourAvailability.aggregate.mockResolvedValueOnce({
        _sum: { totalCapacity: null, remainingSeats: null },
      });
      prisma.tailorMadeInquiry.count.mockResolvedValueOnce(0);
      prisma.contactSubmission.count.mockResolvedValueOnce(0);
      prisma.notificationDeliveryLog.count.mockResolvedValueOnce(0);
      prisma.analyticsEvent.count.mockResolvedValueOnce(0);
      prisma.analyticsEvent.count.mockResolvedValueOnce(0);
      prisma.analyticsEvent.groupBy.mockResolvedValueOnce([]);

      const result: any = await service.getExecutiveSummary({});

      expect(result.revenue.grossRevenue).toBe(0);
      expect(result.revenue.revenueChangePercent).toBe(0);
      expect(result.bookings.total).toBe(0);
      expect(result.conversion.rate).toBe(0);
      expect(result.capacity.occupancyRate).toBe(0);
      expect(result.operational.activeVisitors).toBe(0);
    });
  });

  describe('getActionCenter', () => {
    it('returns prioritized alerts when operational action items exist', async () => {
      prisma.booking.count.mockResolvedValueOnce(3); // pending bookings
      prisma.booking.count.mockResolvedValueOnce(2); // unpaid confirmed
      prisma.tailorMadeInquiry.count.mockResolvedValueOnce(4); // unanswered inquiries
      prisma.tourAvailability.count.mockResolvedValueOnce(1); // low capacity departures
      prisma.notificationDeliveryLog.count.mockResolvedValueOnce(5); // delivery failures

      const alerts = await service.getActionCenter({});

      expect(alerts).toHaveLength(5);
      expect(alerts[0].id).toBe('alert-pending-bookings');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].count).toBe(3);

      expect(alerts[1].id).toBe('alert-new-inquiries');
      expect(alerts[1].count).toBe(4);

      expect(alerts[2].id).toBe('alert-unpaid-confirmed');
      expect(alerts[2].count).toBe(2);

      expect(alerts[3].id).toBe('alert-capacity-warning');
      expect(alerts[3].count).toBe(1);

      expect(alerts[4].id).toBe('alert-delivery-failed');
      expect(alerts[4].count).toBe(5);
    });

    it('returns empty alert array when no operational issues exist', async () => {
      prisma.booking.count.mockResolvedValueOnce(0);
      prisma.booking.count.mockResolvedValueOnce(0);
      prisma.tailorMadeInquiry.count.mockResolvedValueOnce(0);
      prisma.tourAvailability.count.mockResolvedValueOnce(0);
      prisma.notificationDeliveryLog.count.mockResolvedValueOnce(0);

      const alerts = await service.getActionCenter({});
      expect(alerts).toEqual([]);
    });
  });

  describe('getRecentBookings', () => {
    it('formats recent bookings with fallback for guest customers', async () => {
      prisma.booking.findMany.mockResolvedValueOnce([
        {
          id: 'bk-1',
          referenceCode: 'DUNAS-2026-001',
          adults: 2,
          children: 1,
          arrivalDate: new Date('2026-12-01'),
          totalAmountUsd: { toString: () => '1500.00' },
          paidAmountUsd: { toString: () => '1500.00' },
          status: 'CONFIRMED',
          createdAt: new Date('2026-10-30T10:00:00Z'),
          billingInfo: { fullName: 'Omar Farooq', email: 'omar@example.com' },
          tour: {
            id: 'tour-1',
            slug: 'pyramids-deluxe',
            titleJsonb: { en: 'Pyramids Deluxe' },
          },
        },
        {
          id: 'bk-2',
          referenceCode: 'DUNAS-2026-002',
          adults: 1,
          children: 0,
          arrivalDate: new Date('2026-12-05'),
          totalAmountUsd: { toString: () => '800.00' },
          paidAmountUsd: { toString: () => '0.00' },
          status: 'PENDING',
          createdAt: new Date('2026-10-31T09:00:00Z'),
          billingInfo: null,
          tour: {
            id: 'tour-2',
            slug: 'nile-cruise',
            titleJsonb: { en: 'Nile Cruise' },
          },
        },
      ]);

      const recent = await service.getRecentBookings();

      expect(recent).toHaveLength(2);
      expect(recent[0].customerName).toBe('Omar Farooq');
      expect(recent[0].travelersCount).toBe(3);
      expect(recent[0].tourSlug).toBe('pyramids-deluxe');

      expect(recent[1].customerName).toBe('Guest Traveler');
      expect(recent[1].customerEmail).toBe('N/A');
      expect(recent[1].travelersCount).toBe(1);
    });
  });

  describe('getOverview', () => {
    it('returns aggregated overview and caches response', async () => {
      jest
        .spyOn(service, 'getExecutiveSummary')
        .mockResolvedValueOnce({ mockSummary: true });
      jest
        .spyOn(service, 'getRevenueTrend')
        .mockResolvedValueOnce([{ period: '2026-01' }]);
      jest
        .spyOn(service, 'getBookingsTrend')
        .mockResolvedValueOnce([{ period: '2026-01' }]);
      jest
        .spyOn(service, 'getTopDestinations')
        .mockResolvedValueOnce([{ destination: 'Cairo' }] as any);
      jest
        .spyOn(service, 'getTourPerformance')
        .mockResolvedValueOnce({ all: [], rankings: {} });
      jest.spyOn(service, 'getActionCenter').mockResolvedValueOnce([]);
      jest.spyOn(service, 'getRecentBookings').mockResolvedValueOnce([]);
      jest.spyOn(service, 'getRecentActivity').mockResolvedValueOnce([]);

      const overview: any = await service.getOverview({});

      expect(overview.summary).toEqual({ mockSummary: true });
      expect(overview.revenueTrend).toHaveLength(1);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:overview:'),
        overview,
        60000,
      );
    });
  });
});
