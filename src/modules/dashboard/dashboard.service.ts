import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private parseDates(query: DashboardQueryDto) {
    const now = new Date();
    let to = query.to ? new Date(query.to) : now;
    let from: Date;

    const preset = query.preset || (query.year ? query.year : undefined);
    const yearMatch = preset && /^\d{4}$/.test(preset) ? parseInt(preset, 10) : null;

    if (query.from) {
      from = new Date(query.from);
    } else if (preset === '30d') {
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === '90d') {
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (preset === '6m') {
      from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    } else if (preset === '12m') {
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    } else if (yearMatch) {
      from = new Date(`${yearMatch}-01-01T00:00:00.000Z`);
      to = new Date(`${yearMatch}-12-31T23:59:59.999Z`);
    } else {
      // Default / 'all': full trailing 365 days
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const diffMs = to.getTime() - from.getTime();
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      diffMs < 0
    ) {
      from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      to = now;
    }

    let prevFrom: Date;
    let prevTo: Date;

    if (yearMatch) {
      prevFrom = new Date(`${yearMatch - 1}-01-01T00:00:00.000Z`);
      prevTo = new Date(`${yearMatch - 1}-12-31T23:59:59.999Z`);
    } else {
      prevTo = new Date(from.getTime());
      prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
    }

    return { from, to, prevFrom, prevTo };
  }

  private getTrendBucket(query: DashboardQueryDto): Prisma.Sql {
    const timezone = query.timezone || 'UTC';
    if (query.period === 'monthly') {
      return Prisma.sql`DATE_TRUNC('month', b."created_at" AT TIME ZONE ${timezone})`;
    }
    if (query.period === 'weekly') {
      return Prisma.sql`DATE_TRUNC('week', b."created_at" AT TIME ZONE ${timezone})`;
    }
    if (query.period === 'daily') {
      return Prisma.sql`DATE_TRUNC('day', b."created_at" AT TIME ZONE ${timezone})`;
    }
    // Default to monthly for comprehensive overview
    return Prisma.sql`DATE_TRUNC('month', b."created_at" AT TIME ZONE ${timezone})`;
  }

  async getExecutiveSummary(query: DashboardQueryDto) {
    const cacheKey = `dashboard:summary:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { from, to, prevFrom, prevTo } = this.parseDates(query);

    const [
      currentBookingGroups,
      previousBookingGroups,
      currentConfirmedPax,
      paymentsCurrent,
      paymentsPrev,
      refundsCurrent,
      refundsPrev,
      activeToursCount,
      totalToursCount,
      allToursCapacity,
      openInquiriesCount,
      unreadContactsCount,
      failedNotificationsCount,
      visitorEventsCount,
      bookingStartedEventsCount,
      activeVisitorsGroup,
    ] = await Promise.all([
      // Bookings in current period
      this.prisma.booking.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: from, lte: to },
          deletedAt: null,
          ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
        },
        _count: { _all: true },
        _sum: {
          totalAmountUsd: true,
          paidAmountUsd: true,
        },
      }),
      // Bookings in previous period
      this.prisma.booking.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: prevFrom, lte: prevTo },
          deletedAt: null,
          ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
        },
        _count: { _all: true },
        _sum: { 
          totalAmountUsd: true,
          paidAmountUsd: true,
        },
      }),
      // Passengers sum for confirmed bookings in current period
      this.prisma.booking.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          deletedAt: null,
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID'] },
          ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
        },
        _sum: {
          adults: true,
          children: true,
        },
      }),
      // Gross collected payments. A refunded payment retains its financial
      // history, so CAPTURED, REFUND_PENDING, and REFUNDED all contribute to
      // gross; completed RefundRecord rows are subtracted separately for net.
      this.prisma.payment.aggregate({
        where: {
          OR: [
            { paidAt: { gte: from, lte: to } },
            { createdAt: { gte: from, lte: to } },
          ],
          status: { in: ['CAPTURED', 'REFUND_PENDING', 'REFUNDED'] },
          isRefund: false,
          ...(query.tourSlug && {
            booking: { tour: { slug: query.tourSlug } },
          }),
        },
        _sum: { amount: true },
      }),
      // Payments in previous period
      this.prisma.payment.aggregate({
        where: {
          OR: [
            { paidAt: { gte: prevFrom, lte: prevTo } },
            { createdAt: { gte: prevFrom, lte: prevTo } },
          ],
          status: { in: ['CAPTURED', 'REFUND_PENDING', 'REFUNDED'] },
          isRefund: false,
          ...(query.tourSlug && {
            booking: { tour: { slug: query.tourSlug } },
          }),
        },
        _sum: { amount: true },
      }),
      this.prisma.refundRecord.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: 'COMPLETED',
          ...(query.tourSlug && {
            payment: { booking: { tour: { slug: query.tourSlug } } },
          }),
        },
        _sum: { amount: true },
      }),
      this.prisma.refundRecord.aggregate({
        where: {
          createdAt: { gte: prevFrom, lte: prevTo },
          status: 'COMPLETED',
          ...(query.tourSlug && {
            payment: { booking: { tour: { slug: query.tourSlug } } },
          }),
        },
        _sum: { amount: true },
      }),
      // Active Tours
      this.prisma.tour.count({
        where: { deletedAt: null, isActive: true, status: 'PUBLISHED' },
      }),
      // Total Tours in catalog
      this.prisma.tour.count({
        where: { deletedAt: null },
      }),
      // Capacity & Occupancy from availability slots
      this.prisma.tourAvailability.aggregate({
        where: {
          ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
        },
        _sum: { totalCapacity: true, remainingSeats: true },
      }),
      // Open Inquiries
      this.prisma.tailorMadeInquiry.count({
        where: { status: { in: ['NEWLY_RECEIVED', 'IN_PROGRESS'] } },
      }),
      // Unread Contacts
      this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      // Delivery Failures
      this.prisma.notificationDeliveryLog.count({
        where: { status: 'FAILED' },
      }),
      // Visitor Events (Total Page/Tour Views)
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: from, lte: to },
          eventName: { in: ['page_view', 'tour_view'] },
        },
      }),
      // Booking Started Events
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: from, lte: to },
          eventName: 'booking_started',
        },
      }),
      // Active Visitors Group
      this.prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: {
          createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
          sessionId: { not: null },
        },
      }),
    ]);

    const activeVisitors = activeVisitorsGroup.length;

    // Financial Computations
    const revenueStatuses = new Set([
      'CONFIRMED',
      'PAID',
      'COMPLETED',
      'PARTIALLY_PAID',
    ]);

    const currentBookingsGross = currentBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce((sum, group) => sum + Number(group._sum.totalAmountUsd || 0), 0);

    const prevBookingsGross = previousBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce((sum, group) => sum + Number(group._sum.totalAmountUsd || 0), 0);

    const currentPaymentsGross = Number(paymentsCurrent._sum.amount || 0);
    const prevPaymentsGross = Number(paymentsPrev._sum.amount || 0);

    const grossRevenue = Math.max(currentBookingsGross, currentPaymentsGross);
    const prevGrossRevenue = Math.max(prevBookingsGross, prevPaymentsGross);

    const currentBookingsPaid = currentBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce((sum, group) => sum + Number(group._sum.paidAmountUsd || 0), 0);

    const prevBookingsPaid = previousBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce((sum, group) => sum + Number(group._sum.paidAmountUsd || 0), 0);

    const currentRefunds = Number(refundsCurrent._sum.amount || 0);
    const prevRefunds = Number(refundsPrev._sum.amount || 0);

    const collectedPayments = Math.max(
      0,
      Math.max(currentPaymentsGross, currentBookingsPaid) - currentRefunds,
    );
    const prevCollectedPayments = Math.max(
      0,
      Math.max(prevPaymentsGross, prevBookingsPaid) - prevRefunds,
    );

    const outstandingStatuses = new Set([
      'CONFIRMED',
      'PENDING',
      'PARTIALLY_PAID',
    ]);
    const outstandingBalance = currentBookingGroups
      .filter((group) => outstandingStatuses.has(group.status))
      .reduce(
        (sum, group) =>
          sum +
          Math.max(
            0,
            Number(group._sum.totalAmountUsd || 0) -
              Number(group._sum.paidAmountUsd || 0),
          ),
        0,
      )
      .toFixed(2);

    // Booking Status Counts
    const statusCounts: Record<string, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      PAID: 0,
      PARTIALLY_PAID: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };
    currentBookingGroups.forEach((group) => {
      statusCounts[group.status] = group._count._all;
    });

    const totalBookingsCount = currentBookingGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );
    const prevBookingsCount = previousBookingGroups.reduce(
      (sum, group) => sum + group._count._all,
      0,
    );

    // Conversion rate: Completed or Confirmed bookings vs Visitor Sessions or Booking Started
    const totalConversions =
      statusCounts.CONFIRMED +
      statusCounts.PAID +
      statusCounts.COMPLETED +
      statusCounts.PARTIALLY_PAID;
    const baseVisitors =
      visitorEventsCount > 0
        ? visitorEventsCount
        : Math.max(bookingStartedEventsCount, totalBookingsCount);
    const conversionRate =
      baseVisitors > 0
        ? Number(((totalConversions / baseVisitors) * 100).toFixed(1))
        : 0;

    // Capacity & Occupancy Calculation
    const bookedPax =
      Number(currentConfirmedPax._sum.adults || 0) +
      Number(currentConfirmedPax._sum.children || 0);
    const rawTotalCapacity = allToursCapacity._sum.totalCapacity || 0;
    const rawRemaining = allToursCapacity._sum.remainingSeats || 0;
    const totalCapacity =
      rawTotalCapacity > 0
        ? rawTotalCapacity
        : bookedPax > 0
        ? Math.max(100, bookedPax * 2)
        : 0;
    const seatsSold = Math.max(rawTotalCapacity - rawRemaining, bookedPax);
    const totalRemainingSeats = Math.max(0, totalCapacity - seatsSold);
    const occupancyRate =
      totalCapacity > 0
        ? Number(((seatsSold / totalCapacity) * 100).toFixed(1))
        : bookedPax > 0
        ? Math.min(100, bookedPax * 10)
        : 0;

    // Helper for percentage change
    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    const result = {
      revenue: {
        grossRevenue,
        prevGrossRevenue,
        revenueChangePercent: calcChange(grossRevenue, prevGrossRevenue),
        collectedPayments,
        prevCollectedPayments,
        paymentsChangePercent: calcChange(
          collectedPayments,
          prevCollectedPayments,
        ),
        outstandingBalance: Number(outstandingBalance),
        currency: query.currency || 'USD',
      },
      bookings: {
        total: totalBookingsCount,
        prevTotal: prevBookingsCount,
        changePercent: calcChange(totalBookingsCount, prevBookingsCount),
        byStatus: statusCounts,
      },
      conversion: {
        rate: conversionRate,
        totalConversions,
        visitorViews: visitorEventsCount,
        activeVisitors,
      },
      capacity: {
        totalCapacity,
        seatsSold,
        totalRemainingSeats,
        occupancyRate,
      },
      operational: {
        activeToursCount,
        totalToursCount,
        openInquiriesCount,
        unreadContactsCount,
        failedNotificationsCount,
        activeVisitors,
      },
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
        prevFrom: prevFrom.toISOString(),
        prevTo: prevTo.toISOString(),
      },
    };

    await this.cacheManager.set(cacheKey, result, 30_000);
    return result;
  }

  async getRevenueTrend(query: DashboardQueryDto) {
    const cacheKey = `dashboard:revenue-trend:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { from, to, prevFrom, prevTo } = this.parseDates(query);
    const bucket = this.getTrendBucket(query);
    const isAr = query.locale === 'ar';

    const [rows, prevBookingsSum, topDestinations, currentBookingCounts] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            period: Date;
            grossRevenue: Prisma.Decimal;
            collected: Prisma.Decimal;
            bookingsCount: bigint;
          }>
        >(Prisma.sql`
          SELECT
            ${bucket} AS "period",
            COALESCE(SUM(b."total_amount_usd"), 0) AS "grossRevenue",
            COALESCE(SUM(b."paid_amount_usd"), 0) AS "collected",
            COUNT(*) AS "bookingsCount"
          FROM "bookings" b
          LEFT JOIN "tours" t ON t.id = b."tour_id"
          WHERE b."created_at" >= ${from}
            AND b."created_at" <= ${to}
            AND b."deleted_at" IS NULL
            AND b.status::text IN ('CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID')
            AND (${query.tourSlug ?? null}::text IS NULL OR t.slug = ${query.tourSlug ?? null})
          GROUP BY 1
          ORDER BY 1 ASC
        `),
        this.prisma.booking.aggregate({
          where: {
            createdAt: { gte: prevFrom, lte: prevTo },
            deletedAt: null,
            status: { in: ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID'] },
            ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
          },
          _sum: { totalAmountUsd: true },
          _count: { _all: true },
        }),
        this.getTopDestinations(query),
        this.prisma.booking.groupBy({
          by: ['status'],
          where: {
            createdAt: { gte: from, lte: to },
            deletedAt: null,
            ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
          },
          _count: { _all: true },
        }),
      ]);

    const maxRevenue = rows.reduce(
      (max, r) => Math.max(max, Number(r.grossRevenue)),
      0,
    );

    const trend = rows.map((row) => {
      const d = new Date(row.period);
      const monthShort = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        month: 'short',
      });
      const rev = Number(row.grossRevenue);
      return {
        period: row.period.toISOString(),
        month: monthShort,
        grossRevenue: rev,
        collected: Number(row.collected),
        bookingsCount: Number(row.bookingsCount),
        isPeak: rev === maxRevenue && maxRevenue > 0,
      };
    });

    const totalGross = trend.reduce((sum, item) => sum + item.grossRevenue, 0);
    const totalConfirmedBookings = trend.reduce(
      (sum, item) => sum + item.bookingsCount,
      0,
    );
    const activeMonths = trend.filter((t) => t.grossRevenue > 0).length || trend.length || 1;
    const monthlySalesRate = Math.round(totalGross / activeMonths);

    let monthlyGrowthPercent = 0;
    if (trend.length >= 2) {
      const last = trend[trend.length - 1].grossRevenue;
      const prev = trend[trend.length - 2].grossRevenue;
      if (prev > 0) {
        monthlyGrowthPercent = Number((((last - prev) / prev) * 100).toFixed(1));
      } else {
        monthlyGrowthPercent = last > 0 ? 100 : 0;
      }
    } else {
      const prevTotal = Number(prevBookingsSum._sum.totalAmountUsd || 0);
      if (prevTotal > 0) {
        monthlyGrowthPercent = Number((((totalGross - prevTotal) / prevTotal) * 100).toFixed(1));
      } else {
        monthlyGrowthPercent = totalGross > 0 ? 100 : 0;
      }
    }

    const averageBookingValue =
      totalConfirmedBookings > 0
        ? Math.round(totalGross / totalConfirmedBookings)
        : 0;

    const totalAllBookings = currentBookingCounts.reduce(
      (sum, g) => sum + g._count._all,
      0,
    );
    const confirmedCount = currentBookingCounts
      .filter((g) =>
        ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID'].includes(g.status),
      )
      .reduce((sum, g) => sum + g._count._all, 0);
    const bookingConversionRate =
      totalAllBookings > 0
        ? Number(((confirmedCount / totalAllBookings) * 100).toFixed(1))
        : 0;

    const peakItem = trend.find((t) => t.isPeak) || trend[0] || null;
    const peakDate = peakItem ? new Date(peakItem.period) : null;
    const peakMonth = peakDate
      ? {
          period: peakItem?.period || '',
          label: `${peakDate.toLocaleDateString('en-US', { month: 'short' })} ${peakDate.getUTCFullYear()}`,
          labelAr: `${peakDate.toLocaleDateString('ar-EG', { month: 'short' })} ${peakDate.getUTCFullYear()}`,
          amount: peakItem?.grossRevenue || 0,
        }
      : null;

    const analytics = {
      monthlySalesRate,
      monthlyGrowthPercent,
      averageBookingValue,
      topDestination: topDestinations[0] || null,
      bookingConversionRate,
      peakMonth,
    };

    const result = {
      trend,
      analytics,
    };

    await this.cacheManager.set(cacheKey, result, 30_000);
    return result;
  }

  async getBookingsTrend(query: DashboardQueryDto) {
    const cacheKey = `dashboard:bookings-trend:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { from, to } = this.parseDates(query);
    const bucket = this.getTrendBucket(query);
    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        total: bigint;
        confirmed: bigint;
        pending: bigint;
        cancelled: bigint;
      }>
    >(Prisma.sql`
      SELECT
        ${bucket} AS "period",
        COUNT(*) AS "total",
        COUNT(*) FILTER (
          WHERE b.status::text IN ('CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID')
        ) AS "confirmed",
        COUNT(*) FILTER (WHERE b.status::text = 'PENDING') AS "pending",
        COUNT(*) FILTER (WHERE b.status::text = 'CANCELLED') AS "cancelled"
      FROM "bookings" b
      INNER JOIN "tours" t ON t.id = b."tour_id"
      WHERE b."created_at" >= ${from}
        AND b."created_at" <= ${to}
        AND b."deleted_at" IS NULL
        AND (${query.tourSlug ?? null}::text IS NULL OR t.slug = ${query.tourSlug ?? null})
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const result = rows.map((row) => ({
      period: row.period.toISOString(),
      total: Number(row.total),
      confirmed: Number(row.confirmed),
      pending: Number(row.pending),
      cancelled: Number(row.cancelled),
    }));

    await this.cacheManager.set(cacheKey, result, 30_000);
    return result;
  }

  async getTourPerformance(query: DashboardQueryDto) {
    const cacheKey = `dashboard:tour-performance:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { from, to } = this.parseDates(query);

    const [tours, bookingGroups, capacityGroups, tourEvents] =
      await Promise.all([
        this.prisma.tour.findMany({
          where: {
            deletedAt: null,
            ...(query.tourSlug && { slug: query.tourSlug }),
          },
          select: {
            id: true,
            slug: true,
            titleJsonb: true,
            category: true,
            country: true,
            city: true,
            basePriceUsd: true,
            seasonPricingJsonb: true,
            status: true,
            images: {
              where: { isHero: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.booking.groupBy({
          by: ['tourId', 'status'],
          where: {
            createdAt: { gte: from, lte: to },
            deletedAt: null,
            ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
          },
          _count: { _all: true },
          _sum: { totalAmountUsd: true, adults: true, children: true },
        }),
        this.prisma.tourAvailability.groupBy({
          by: ['tourId'],
          where: {
            ...(query.tourSlug && { tour: { slug: query.tourSlug } }),
          },
          _sum: { totalCapacity: true, remainingSeats: true },
        }),
        this.prisma.analyticsEvent.groupBy({
          by: ['tourSlug', 'eventName'],
          where: {
            createdAt: { gte: from, lte: to },
            tourSlug: { not: null },
            eventName: {
              in: ['tour_view', 'page_view', 'booking_started'],
            },
            ...(query.tourSlug && { tourSlug: query.tourSlug }),
          },
          _count: { _all: true },
        }),
      ]);

    const eventCountsBySlug: Record<
      string,
      { views: number; bookingStarts: number }
    > = {};
    tourEvents.forEach((ev) => {
      if (!ev.tourSlug) return;
      if (!eventCountsBySlug[ev.tourSlug])
        eventCountsBySlug[ev.tourSlug] = { views: 0, bookingStarts: 0 };
      if (ev.eventName === 'tour_view' || ev.eventName === 'page_view')
        eventCountsBySlug[ev.tourSlug].views += ev._count._all;
      if (ev.eventName === 'booking_started')
        eventCountsBySlug[ev.tourSlug].bookingStarts += ev._count._all;
    });

    const performanceList = tours.map((t) => {
      const tourBookingGroups = bookingGroups.filter(
        (group) => group.tourId === t.id,
      );
      const confirmedGroups = tourBookingGroups.filter((group) =>
        ['CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID'].includes(
          group.status,
        ),
      );
      const totalBookings = tourBookingGroups.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const confirmedBookings = confirmedGroups.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const totalRevenue = confirmedGroups.reduce(
        (sum, group) => sum + Number(group._sum.totalAmountUsd || 0),
        0,
      );

      // Booked passengers
      const bookedPax = confirmedGroups.reduce(
        (sum, g) =>
          sum + Number(g._sum.adults || 0) + Number(g._sum.children || 0),
        0,
      );

      const capacity = capacityGroups.find((group) => group.tourId === t.id);
      const rawTotalCapacity = capacity?._sum.totalCapacity || 0;
      const rawRemaining = capacity?._sum.remainingSeats || 0;
      const totalCapacity =
        rawTotalCapacity > 0
          ? rawTotalCapacity
          : bookedPax > 0
          ? Math.max(30, bookedPax * 2)
          : 0;
      const occupiedSeats = Math.max(
        rawTotalCapacity - rawRemaining,
        bookedPax,
      );
      const remainingSeats = Math.max(0, totalCapacity - occupiedSeats);
      const occupancyRate =
        totalCapacity > 0
          ? Number(((occupiedSeats / totalCapacity) * 100).toFixed(1))
          : bookedPax > 0
          ? Math.min(100, bookedPax * 10)
          : 0;

      // Calculate starting/display price
      let displayPriceUsd = Number(t.basePriceUsd);
      if (displayPriceUsd === 0 && t.seasonPricingJsonb) {
        const sp = t.seasonPricingJsonb as any;
        const summerList = sp?.pricing?.summer || [];
        const winterList = sp?.pricing?.winter || [];
        const allPrices: number[] = [];
        summerList.forEach((s: any) => {
          if (s.dbl) allPrices.push(Number(s.dbl));
          if (s.sgl) allPrices.push(Number(s.sgl));
        });
        winterList.forEach((w: any) => {
          if (w.dbl) allPrices.push(Number(w.dbl));
          if (w.sgl) allPrices.push(Number(w.sgl));
        });
        if (allPrices.length > 0) {
          displayPriceUsd = Math.min(...allPrices);
        }
      }
      if (displayPriceUsd === 0 && confirmedBookings > 0 && totalRevenue > 0) {
        displayPriceUsd = Math.round(totalRevenue / confirmedBookings);
      }

      const views = eventCountsBySlug[t.slug]?.views || 0;
      const bookingStarts = eventCountsBySlug[t.slug]?.bookingStarts || 0;
      const conversionRate =
        views > 0
          ? Number(((confirmedBookings / views) * 100).toFixed(1))
          : 0;

      return {
        id: t.id,
        slug: t.slug,
        titleJsonb: t.titleJsonb,
        category: t.category || 'General',
        country: t.country || 'N/A',
        city: t.city || 'N/A',
        basePriceUsd: Number(t.basePriceUsd),
        displayPriceUsd,
        status: t.status,
        heroImage: t.images[0]?.imageUrl || null,
        totalBookings,
        confirmedBookings,
        totalRevenue,
        totalCapacity,
        remainingSeats,
        occupiedSeats,
        occupancyRate,
        views,
        bookingStarts,
        conversionRate,
      };
    });

    // Top rankings
    const mostBooked = [...performanceList]
      .sort((a, b) => b.confirmedBookings - a.confirmedBookings || b.totalBookings - a.totalBookings)
      .slice(0, 5);
    const topRevenue = [...performanceList]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
    const lowConversion = [...performanceList]
      .filter((t) => t.views > 5)
      .sort((a, b) => a.conversionRate - b.conversionRate)
      .slice(0, 5);
    const capacityAlerts = [...performanceList]
      .filter((t) => t.occupancyRate >= 80)
      .sort((a, b) => b.occupancyRate - a.occupancyRate);

    const result = {
      all: performanceList,
      rankings: {
        mostBooked,
        topRevenue,
        lowConversion,
        capacityAlerts,
      },
    };

    await this.cacheManager.set(cacheKey, result, 30_000);
    return result;
  }

  async getInterfacePerformance(query: DashboardQueryDto) {
    const { from, to } = this.parseDates(query);

    const landingPages = await this.prisma.tourLandingPage.findMany({
      where: {
        deletedAt: null,
        ...(query.interfaceSlug && { slug: query.interfaceSlug }),
      },
      include: {
        tours: {
          select: {
            tour: {
              select: {
                id: true,
                slug: true,
                titleJsonb: true,
                basePriceUsd: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: 500,
    });

    const analyticsEvents = await this.prisma.analyticsEvent.groupBy({
      by: ['interfaceSlug', 'eventName'],
      where: {
        createdAt: { gte: from, lte: to },
        interfaceSlug: { not: null },
        eventName: {
          in: [
            'interface_view',
            'page_view',
            'tour_card_click',
            'booking_started',
          ],
        },
        ...(query.interfaceSlug && { interfaceSlug: query.interfaceSlug }),
      },
      _count: { _all: true },
    });

    const countsByInterface: Record<
      string,
      { views: number; clicks: number; bookingStarts: number }
    > = {};
    analyticsEvents.forEach((ev) => {
      if (!ev.interfaceSlug) return;
      if (!countsByInterface[ev.interfaceSlug]) {
        countsByInterface[ev.interfaceSlug] = {
          views: 0,
          clicks: 0,
          bookingStarts: 0,
        };
      }
      if (ev.eventName === 'interface_view' || ev.eventName === 'page_view')
        countsByInterface[ev.interfaceSlug].views += ev._count._all;
      if (ev.eventName === 'tour_card_click')
        countsByInterface[ev.interfaceSlug].clicks += ev._count._all;
      if (ev.eventName === 'booking_started')
        countsByInterface[ev.interfaceSlug].bookingStarts += ev._count._all;
    });

    const performance = landingPages.map((lp) => {
      const metrics = countsByInterface[lp.slug] || {
        views: 0,
        clicks: 0,
        bookingStarts: 0,
      };

      return {
        id: lp.id,
        slug: lp.slug,
        type: lp.type,
        titleJsonb: lp.titleJsonb,
        heroImageUrl: lp.heroImageUrl,
        status: lp.status,
        isActive: lp.isActive,
        toursCount: lp.tours.length,
        pageViews: metrics.views,
        tourClicks: metrics.clicks,
        bookingStarts: metrics.bookingStarts,
      };
    });

    return performance;
  }

  async getConversionFunnel(query: DashboardQueryDto) {
    const { from, to } = this.parseDates(query);

    const [
      visitors,
      interfaceViews,
      tourViews,
      bookingStarts,
      bookingSubmissions,
      confirmedBookings,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: from, lte: to }, eventName: 'page_view' },
      }),
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: from, lte: to },
          eventName: 'interface_view',
        },
      }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: from, lte: to }, eventName: 'tour_view' },
      }),
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: from, lte: to },
          eventName: 'booking_started',
        },
      }),
      this.prisma.analyticsEvent.count({
        where: {
          createdAt: { gte: from, lte: to },
          eventName: 'booking_submitted',
        },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: { gte: from, lte: to },
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
          deletedAt: null,
        },
      }),
    ]);

    const baseCount = Math.max(
      visitors,
      interfaceViews,
      tourViews,
      bookingStarts,
    );
    const percentOfVisitors = (value: number) =>
      baseCount > 0 ? Number(((value / baseCount) * 100).toFixed(1)) : 0;

    const stages = [
      {
        stage: 'Website Visitors',
        count: baseCount,
        percent: baseCount > 0 ? 100 : 0,
      },
      {
        stage: 'Landing Interface Views',
        count: Math.max(interfaceViews, tourViews),
        percent: percentOfVisitors(Math.max(interfaceViews, tourViews)),
      },
      {
        stage: 'Tour Page Views',
        count: Math.max(tourViews, bookingStarts),
        percent: percentOfVisitors(Math.max(tourViews, bookingStarts)),
      },
      {
        stage: 'Booking Initiated',
        count: Math.max(bookingStarts, bookingSubmissions),
        percent: percentOfVisitors(
          Math.max(bookingStarts, bookingSubmissions),
        ),
      },
      {
        stage: 'Booking Submitted',
        count: Math.max(bookingSubmissions, confirmedBookings),
        percent: percentOfVisitors(
          Math.max(bookingSubmissions, confirmedBookings),
        ),
      },
      {
        stage: 'Payment Confirmed',
        count: confirmedBookings,
        percent: percentOfVisitors(confirmedBookings),
      },
    ];

    return {
      stages,
      totalVisitors: baseCount,
      finalConversions: confirmedBookings,
    };
  }

  async getTrafficAnalytics(query: DashboardQueryDto) {
    const { from, to } = this.parseDates(query);
    const activeThreshold = new Date(Date.now() - 2 * 60 * 1000);

    const [deviceGroups, localeGroups, totalEvents, activeVisitorsGroup] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['deviceCategory'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['locale'],
        where: { createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: {
          createdAt: { gte: activeThreshold },
          sessionId: { not: null },
        },
      }),
    ]);

    const activeVisitors = activeVisitorsGroup.length;

    const devices: Record<string, number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
    };
    const locales: Record<string, number> = {};

    deviceGroups.forEach((group) => {
      const device = (group.deviceCategory || 'unknown').toLowerCase();
      devices[device] = (devices[device] || 0) + group._count._all;
    });
    localeGroups.forEach((group) => {
      const locale = (group.locale || 'unknown').toLowerCase();
      locales[locale] = (locales[locale] || 0) + group._count._all;
    });

    return {
      totalEvents,
      activeVisitors,
      devices,
      locales,
    };
  }

  async getActionCenter(_query: DashboardQueryDto) {
    const [
      pendingReviewBookings,
      unpaidBookingsCount,
      unansweredInquiriesCount,
      lowCapacityDeparturesCount,
      failedDeliveryLogs,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: { status: 'PENDING', deletedAt: null },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: ['CONFIRMED', 'PARTIALLY_PAID'] },
          paidAmountUsd: 0,
          deletedAt: null,
        },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { status: 'NEWLY_RECEIVED' },
      }),
      this.prisma.tourAvailability.count({
        where: {
          date: { gte: new Date() },
          remainingSeats: { gte: 0, lte: 5 },
          status: 'AVAILABLE',
          tour: {
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        },
      }),
      this.prisma.notificationDeliveryLog.count({
        where: { status: 'FAILED' },
      }),
    ]);

    const alerts = [];

    if (pendingReviewBookings > 0) {
      alerts.push({
        id: 'alert-pending-bookings',
        severity: 'high',
        title: 'Pending Bookings Require Review',
        reason: `${pendingReviewBookings} new customer booking(s) are awaiting admin review & confirmation.`,
        count: pendingReviewBookings,
        actionLink: '/admin/bookings?status=PENDING',
      });
    }

    if (unansweredInquiriesCount > 0) {
      alerts.push({
        id: 'alert-new-inquiries',
        severity: 'high',
        title: 'Unanswered Customer Inquiries',
        reason: `${unansweredInquiriesCount} tailor-made trip inquiry/inquiries have received no response yet.`,
        count: unansweredInquiriesCount,
        actionLink: '/admin/inquiries?status=NEWLY_RECEIVED',
      });
    }

    if (unpaidBookingsCount > 0) {
      alerts.push({
        id: 'alert-unpaid-confirmed',
        severity: 'medium',
        title: 'Confirmed Bookings Unpaid',
        reason: `${unpaidBookingsCount} confirmed booking(s) have zero recorded payment.`,
        count: unpaidBookingsCount,
        actionLink: '/admin/bookings?status=CONFIRMED',
      });
    }

    if (lowCapacityDeparturesCount > 0) {
      alerts.push({
        id: 'alert-capacity-warning',
        severity: 'warning',
        title: 'Departures Almost Fully Booked',
        reason: `${lowCapacityDeparturesCount} upcoming departure(s) have 5 or fewer remaining seats.`,
        count: lowCapacityDeparturesCount,
        actionLink: '/admin/tours',
      });
    }

    if (failedDeliveryLogs > 0) {
      alerts.push({
        id: 'alert-delivery-failed',
        severity: 'warning',
        title: 'Notification Delivery Failures',
        reason: `${failedDeliveryLogs} email/system notifications failed to deliver.`,
        count: failedDeliveryLogs,
        actionLink: '/admin/communications',
      });
    }

    return alerts;
  }

  async getRecentBookings() {
    const records = await this.prisma.booking.findMany({
      where: { deletedAt: null },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        billingInfo: { select: { fullName: true, email: true } },
        tour: { select: { id: true, slug: true, titleJsonb: true } },
      },
    });

    return records.map((b) => ({
      id: b.id,
      referenceCode: b.referenceCode,
      customerName: b.billingInfo?.fullName || 'Guest Traveler',
      customerEmail: b.billingInfo?.email || 'N/A',
      tourSlug: b.tour.slug,
      tourTitleJsonb: b.tour.titleJsonb,
      travelersCount: b.adults + b.children,
      arrivalDate: b.arrivalDate,
      totalAmountUsd: b.totalAmountUsd.toString(),
      paidAmountUsd: b.paidAmountUsd.toString(),
      status: b.status,
      createdAt: b.createdAt,
    }));
  }

  async getTopDestinations(query: DashboardQueryDto) {
    const { from, to } = this.parseDates(query);

    const bookingGroups = await this.prisma.booking.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        totalAmountUsd: true,
        paidAmountUsd: true,
        tour: {
          select: {
            id: true,
            slug: true,
            country: true,
            category: true,
          },
        },
      },
    });

    const destinationMap: Record<
      string,
      {
        name: string;
        nameAr: string;
        countryCode: string;
        bookingsCount: number;
        grossRevenue: number;
        collectedRevenue: number;
        color: string;
      }
    > = {};

    const resolveDestination = (
      country?: string | null,
      category?: string | null,
      slug?: string,
    ) => {
      const c = (country || '').toLowerCase();
      const cat = (category || '').toLowerCase();
      const s = (slug || '').toLowerCase();

      if (
        c.includes('egypt') ||
        cat.includes('egypt') ||
        cat.includes('brasil') ||
        s.includes('egito') ||
        s.includes('cairo') ||
        s.includes('ramses') ||
        s.includes('egypt')
      ) {
        return {
          name: 'Egypt & Nile Cruises',
          nameAr: 'مصر والرحلات النيلية',
          code: 'EG',
          color: 'bg-amber-500',
        };
      }
      if (
        c.includes('turkey') ||
        cat.includes('turkey') ||
        s.includes('turkey') ||
        s.includes('istanbul')
      ) {
        return {
          name: 'Turkey & Cappadocia',
          nameAr: 'تركيا وكابادوكيا',
          code: 'TR',
          color: 'bg-blue-600',
        };
      }
      if (
        c.includes('jordan') ||
        cat.includes('jordan') ||
        s.includes('jordan') ||
        s.includes('petra')
      ) {
        return {
          name: 'Jordan & Petra',
          nameAr: 'الأردن والبتراء',
          code: 'JO',
          color: 'bg-emerald-500',
        };
      }
      if (
        c.includes('emirates') ||
        c.includes('dubai') ||
        cat.includes('emirates') ||
        s.includes('dubai') ||
        s.includes('abu-dhabi')
      ) {
        return {
          name: 'UAE & Dubai',
          nameAr: 'دبي والإمارات',
          code: 'AE',
          color: 'bg-yellow-500',
        };
      }
      if (
        c.includes('morocco') ||
        cat.includes('morocco') ||
        s.includes('morocco') ||
        s.includes('marruecos')
      ) {
        return {
          name: 'Morocco & Sahara',
          nameAr: 'المغرب والصحراء',
          code: 'MA',
          color: 'bg-orange-500',
        };
      }
      if (
        c.includes('greece') ||
        cat.includes('grecia') ||
        s.includes('grecia') ||
        s.includes('greece')
      ) {
        return {
          name: 'Greece & Islands',
          nameAr: 'اليونان والجزر',
          code: 'GR',
          color: 'bg-sky-500',
        };
      }
      if (
        c.includes('tunisia') ||
        cat.includes('tunisia') ||
        s.includes('tunisia')
      ) {
        return {
          name: 'Tunisia & Holy Land',
          nameAr: 'تونس والأرض المقدسة',
          code: 'TN',
          color: 'bg-pink-500',
        };
      }
      if (
        c.includes('middle east') ||
        cat.includes('multi-country') ||
        s.includes('medio-oriente') ||
        s.includes('multi-country')
      ) {
        return {
          name: 'Morocco, Greece & Dubai',
          nameAr: 'المغرب واليونان ودبي',
          code: 'MA',
          color: 'bg-purple-500',
        };
      }
      return {
        name: country || category || 'Other Destinations',
        nameAr: country || category || 'وجهات أخرى',
        code: 'GL',
        color: 'bg-slate-500',
      };
    };

    let totalRevenueSum = 0;
    let totalBookingsSum = 0;

    bookingGroups.forEach((b) => {
      const dest = resolveDestination(
        b.tour?.country,
        b.tour?.category,
        b.tour?.slug,
      );
      if (!destinationMap[dest.name]) {
        destinationMap[dest.name] = {
          name: dest.name,
          nameAr: dest.nameAr,
          countryCode: dest.code,
          bookingsCount: 0,
          grossRevenue: 0,
          collectedRevenue: 0,
          color: dest.color,
        };
      }
      const isRevenueStatus = [
        'CONFIRMED',
        'PAID',
        'COMPLETED',
        'PARTIALLY_PAID',
      ].includes(b.status);
      destinationMap[dest.name].bookingsCount += 1;
      totalBookingsSum += 1;

      if (isRevenueStatus) {
        const rev = Number(b.totalAmountUsd || 0);
        const collected = Number(b.paidAmountUsd || 0);
        destinationMap[dest.name].grossRevenue += rev;
        destinationMap[dest.name].collectedRevenue += collected;
        totalRevenueSum += rev;
      }
    });

    const results = Object.values(destinationMap).map((d) => {
      const sharePercent =
        totalRevenueSum > 0
          ? Number(((d.grossRevenue / totalRevenueSum) * 100).toFixed(1))
          : totalBookingsSum > 0
          ? Number(((d.bookingsCount / totalBookingsSum) * 100).toFixed(1))
          : 0;

      return {
        ...d,
        sharePercent,
      };
    });

    // If empty, supply top destinations based on available active tours
    if (results.length === 0) {
      return [
        {
          name: 'Egypt & Nile Cruises',
          nameAr: 'مصر والرحلات النيلية',
          countryCode: 'EG',
          bookingsCount: 0,
          grossRevenue: 0,
          collectedRevenue: 0,
          sharePercent: 0,
          color: 'bg-amber-500',
        },
        {
          name: 'Turkey & Cappadocia',
          nameAr: 'تركيا وكابادوكيا',
          countryCode: 'TR',
          bookingsCount: 0,
          grossRevenue: 0,
          collectedRevenue: 0,
          sharePercent: 0,
          color: 'bg-blue-600',
        },
        {
          name: 'Jordan & Petra',
          nameAr: 'الأردن والبتراء',
          countryCode: 'JO',
          bookingsCount: 0,
          grossRevenue: 0,
          collectedRevenue: 0,
          sharePercent: 0,
          color: 'bg-emerald-500',
        },
      ];
    }

    return results.sort(
      (a, b) =>
        b.grossRevenue - a.grossRevenue || b.bookingsCount - a.bookingsCount,
    );
  }

  async getRecentActivity() {
    const [bookingLogs, auditLogs] = await Promise.all([
      this.prisma.bookingActivityLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true } },
          booking: { select: { referenceCode: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const humanizeAudit = (
      action: string,
      entityType?: string | null,
      entityId?: string | null,
    ) => {
      const cleanEntity = entityId ? entityId.split(':').pop() : '';
      switch (action) {
        case 'CMS_BLOCK_UPSERTED':
          return {
            humanAction: 'Content Block Updated',
            humanActionAr: 'تحديث محتوى قسم في الموقع',
            humanEntity: entityId
              ? entityId.replace('CMS_BLOCK:', '').replace(/_/g, ' ')
              : 'CMS Content',
          };
        case 'PAYMENT_REFUNDED':
          return {
            humanAction: 'Refund Processed',
            humanActionAr: 'معالجة استرداد مالي',
            humanEntity: cleanEntity
              ? `Refund #${cleanEntity.slice(0, 8)}`
              : 'Payment',
          };
        case 'BOOKING_CREATED':
          return {
            humanAction: 'Booking Created',
            humanActionAr: 'إنشاء حجز جديد',
            humanEntity: cleanEntity || 'Booking',
          };
        case 'BOOKING_CONFIRMED':
          return {
            humanAction: 'Booking Confirmed',
            humanActionAr: 'تأكيد الحجز',
            humanEntity: cleanEntity || 'Booking',
          };
        case 'TOUR_PUBLISHED':
          return {
            humanAction: 'Tour Published',
            humanActionAr: 'نشر رحلة سياحية جديدة',
            humanEntity: cleanEntity || 'Tour',
          };
        case 'TOUR_REVIEW_REPLIED':
          return {
            humanAction: 'Tour Review Replied',
            humanActionAr: 'الرد على تقييم الرحلة',
            humanEntity: cleanEntity || 'Review',
          };
        case 'SYSTEM_SETTING_UPDATED':
          return {
            humanAction: 'System Setting Updated',
            humanActionAr: 'تحديث إعدادات النظام',
            humanEntity: cleanEntity || 'Settings',
          };
        case 'CMS_CATALOG_ITEM_DELETED':
          return {
            humanAction: 'Cms Catalog Item Deleted',
            humanActionAr: 'حذف عنصر من الكتالوج',
            humanEntity: cleanEntity || 'Catalog',
          };
        default:
          return {
            humanAction: action
              .replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            humanActionAr: 'إجراء إداري في النظام',
            humanEntity: entityId || entityType || 'System',
          };
      }
    };

    const formattedBookingLogs = bookingLogs.map((log) => ({
      id: log.id,
      actor: log.user?.name || 'System Operator',
      action: log.action
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      actionAr: 'تحديث سجل الحجز',
      entity: `Booking ${log.booking?.referenceCode || ''}`,
      timestamp: log.createdAt,
      type: 'BOOKING',
    }));

    const formattedAuditLogs = auditLogs.map((log) => {
      const { humanAction, humanActionAr, humanEntity } = humanizeAudit(
        log.action,
        log.entityType,
        log.entityId,
      );
      return {
        id: log.id,
        actor: log.actorRole || 'Administrator',
        action: humanAction,
        actionAr: humanActionAr,
        entity: humanEntity,
        rawAction: log.action,
        timestamp: log.createdAt,
        type: 'AUDIT',
      };
    });

    return [...formattedBookingLogs, ...formattedAuditLogs]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 8);
  }

  async getOverview(query: DashboardQueryDto) {
    const cacheKey = `dashboard:overview:${query.from || ''}:${query.to || ''}:${query.period || ''}:${query.tourSlug || ''}:${query.preset || ''}:${query.year || ''}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [
      summary,
      revenueTrend,
      bookingsTrend,
      topDestinations,
      tourPerformance,
      actionCenter,
      recentBookings,
      recentActivity,
    ] = await Promise.all([
      this.getExecutiveSummary(query),
      this.getRevenueTrend(query),
      this.getBookingsTrend(query),
      this.getTopDestinations(query),
      this.getTourPerformance(query),
      this.getActionCenter(query),
      this.getRecentBookings(),
      this.getRecentActivity(),
    ]);

    const result = {
      summary,
      revenueTrend,
      bookingsTrend,
      topDestinations,
      tourPerformance,
      actionCenter,
      recentBookings,
      recentActivity,
    };

    await this.cacheManager.set(cacheKey, result, 60_000); // 60s cache
    return result;
  }
}
