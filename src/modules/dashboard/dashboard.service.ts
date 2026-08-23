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
    const to = query.to ? new Date(query.to) : now;
    const from = query.from
      ? new Date(query.from)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // default last 30 days

    const diffMs = to.getTime() - from.getTime();
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      diffMs < 0 ||
      diffMs > 366 * 24 * 60 * 60 * 1000 ||
      to.getTime() > now.getTime() + 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Dashboard date range must be valid and no longer than 366 days',
      );
    }
    const prevTo = new Date(from.getTime());
    const prevFrom = new Date(from.getTime() - diffMs);

    return { from, to, prevFrom, prevTo };
  }

  private getTrendBucket(query: DashboardQueryDto): Prisma.Sql {
    const timezone = query.timezone || 'UTC';
    switch (query.period) {
      case 'weekly':
        return Prisma.sql`DATE_TRUNC('week', b."created_at" AT TIME ZONE ${timezone})`;
      case 'monthly':
        return Prisma.sql`DATE_TRUNC('month', b."created_at" AT TIME ZONE ${timezone})`;
      default:
        return Prisma.sql`DATE_TRUNC('day', b."created_at" AT TIME ZONE ${timezone})`;
    }
  }

  async getExecutiveSummary(query: DashboardQueryDto) {
    const { from, to, prevFrom, prevTo } = this.parseDates(query);

    const [
      currentBookingGroups,
      previousBookingGroups,
      paymentsCurrent,
      paymentsPrev,
      refundsCurrent,
      refundsPrev,
      activeToursCount,
      allToursCapacity,
      openInquiriesCount,
      unreadContactsCount,
      failedNotificationsCount,
      visitorEventsCount,
      bookingStartedEventsCount,
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
        _sum: { totalAmountUsd: true },
      }),
      // Payments in current period (only CAPTURED or non-refunded paid)
      this.prisma.payment.aggregate({
        where: {
          createdAt: { gte: from, lte: to },
          status: 'CAPTURED',
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
          createdAt: { gte: prevFrom, lte: prevTo },
          status: 'CAPTURED',
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
      // Capacity & Occupancy
      this.prisma.tourAvailability.aggregate({
        where: {
          date: { gte: from, lte: to },
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
    ]);

    // Financial Computations
    const revenueStatuses = new Set([
      'CONFIRMED',
      'PAID',
      'COMPLETED',
      'PARTIALLY_PAID',
    ]);
    const grossRevenue = currentBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce(
        (sum, group) => sum + Number(group._sum.totalAmountUsd || 0),
        0,
      );

    const prevGrossRevenue = previousBookingGroups
      .filter((group) => revenueStatuses.has(group.status))
      .reduce(
        (sum, group) => sum + Number(group._sum.totalAmountUsd || 0),
        0,
      );

    const collectedPayments =
      Number(paymentsCurrent._sum.amount || 0) -
      Number(refundsCurrent._sum.amount || 0);
    const prevCollectedPayments =
      Number(paymentsPrev._sum.amount || 0) -
      Number(refundsPrev._sum.amount || 0);

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

    // Capacity & Occupancy
    const totalCapacity = allToursCapacity._sum.totalCapacity || 0;
    const totalRemaining = allToursCapacity._sum.remainingSeats || 0;
    const seatsSold = totalCapacity - totalRemaining;
    const occupancyRate =
      totalCapacity > 0
        ? Number(((seatsSold / totalCapacity) * 100).toFixed(1))
        : 0;

    // Helper for percentage change
    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prev) / prev) * 100).toFixed(1));
    };

    return {
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
      },
      capacity: {
        totalCapacity,
        seatsSold,
        totalRemainingSeats: totalRemaining,
        occupancyRate,
      },
      operational: {
        activeToursCount,
        openInquiriesCount,
        unreadContactsCount,
        failedNotificationsCount,
      },
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
        prevFrom: prevFrom.toISOString(),
        prevTo: prevTo.toISOString(),
      },
    };
  }

  async getRevenueTrend(query: DashboardQueryDto) {
    const { from, to } = this.parseDates(query);
    const bucket = this.getTrendBucket(query);
    const rows = await this.prisma.$queryRaw<
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
      INNER JOIN "tours" t ON t.id = b."tour_id"
      WHERE b."created_at" >= ${from}
        AND b."created_at" <= ${to}
        AND b."deleted_at" IS NULL
        AND b.status::text IN ('CONFIRMED', 'PAID', 'COMPLETED', 'PARTIALLY_PAID')
        AND (${query.tourSlug ?? null}::text IS NULL OR t.slug = ${query.tourSlug ?? null})
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return rows.map((row) => ({
      period: row.period.toISOString(),
      grossRevenue: Number(row.grossRevenue),
      collected: Number(row.collected),
      bookingsCount: Number(row.bookingsCount),
    }));
  }

  async getBookingsTrend(query: DashboardQueryDto) {
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

    return rows.map((row) => ({
      period: row.period.toISOString(),
      total: Number(row.total),
      confirmed: Number(row.confirmed),
      pending: Number(row.pending),
      cancelled: Number(row.cancelled),
    }));
  }

  async getTourPerformance(query: DashboardQueryDto) {
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
          _sum: { totalAmountUsd: true },
        }),
        this.prisma.tourAvailability.groupBy({
          by: ['tourId'],
          where: {
            date: { gte: from, lte: to },
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
      const capacity = capacityGroups.find((group) => group.tourId === t.id);
      const totalCapacity = capacity?._sum.totalCapacity || 0;
      const remainingSeats = capacity?._sum.remainingSeats || 0;
      const occupiedSeats = Math.max(0, totalCapacity - remainingSeats);
      const occupancyRate =
        totalCapacity > 0
          ? Number(((occupiedSeats / totalCapacity) * 100).toFixed(1))
          : 0;

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
      .sort((a, b) => b.confirmedBookings - a.confirmedBookings)
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

    return {
      all: performanceList,
      rankings: {
        mostBooked,
        topRevenue,
        lowConversion,
        capacityAlerts,
      },
    };
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

    const [deviceGroups, localeGroups, totalEvents] = await Promise.all([
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
    ]);

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

  async getRecentActivity() {
    const [bookingLogs, auditLogs] = await Promise.all([
      this.prisma.bookingActivityLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true } },
          booking: { select: { referenceCode: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedBookingLogs = bookingLogs.map((log) => ({
      id: log.id,
      actor: log.user?.name || 'System',
      action: log.action,
      entity: `Booking ${log.booking.referenceCode}`,
      timestamp: log.createdAt,
      type: 'BOOKING',
    }));

    const formattedAuditLogs = auditLogs.map((log) => ({
      id: log.id,
      actor: log.actorRole || 'Admin',
      action: log.action,
      entity: `${log.entityType || 'System'}:${log.entityId || 'Global'}`,
      timestamp: log.createdAt,
      type: 'AUDIT',
    }));

    return [...formattedBookingLogs, ...formattedAuditLogs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  async getOverview(query: DashboardQueryDto) {
    const cacheKey = `dashboard:overview:${query.from || ''}:${query.to || ''}:${query.period || ''}:${query.tourSlug || ''}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const [
      summary,
      revenueTrend,
      bookingsTrend,
      tourPerformance,
      actionCenter,
      recentBookings,
      recentActivity,
    ] = await Promise.all([
      this.getExecutiveSummary(query),
      this.getRevenueTrend(query),
      this.getBookingsTrend(query),
      this.getTourPerformance(query),
      this.getActionCenter(query),
      this.getRecentBookings(),
      this.getRecentActivity(),
    ]);

    const result = {
      summary,
      revenueTrend,
      bookingsTrend,
      tourPerformance,
      actionCenter,
      recentBookings,
      recentActivity,
    };

    await this.cacheManager.set(cacheKey, result, 60_000); // 60s cache
    return result;
  }
}
