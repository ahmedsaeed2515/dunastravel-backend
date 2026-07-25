import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(dto: TrackEventDto) {
    try {
      // PII sanitization: do not store raw IP or credit card info in properties
      const sanitizedProperties = dto.properties ? { ...dto.properties } : {};
      delete sanitizedProperties['creditCard'];
      delete sanitizedProperties['password'];
      delete sanitizedProperties['token'];

      const event = await this.prisma.analyticsEvent.create({
        data: {
          eventId: dto.eventId,
          eventName: dto.eventName,
          sessionId: dto.sessionId || null,
          userId: dto.userId || null,
          interfaceSlug: dto.interfaceSlug || null,
          tourSlug: dto.tourSlug || null,
          bookingRef: dto.bookingRef || null,
          locale: dto.locale || 'en',
          pathname: dto.pathname || null,
          referrer: dto.referrer || null,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null,
          deviceCategory: dto.deviceCategory || 'desktop',
          properties:
            (sanitizedProperties as Prisma.InputJsonValue) || Prisma.JsonNull,
        },
      });

      return { success: true, eventId: event.id };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'P2002') {
        return { success: true, deduplicated: true };
      }
      this.logger.error(
        `Failed to track analytics event: ${error.message || String(err)}`,
      );
      return { success: false, error: error.message || 'Tracking failed' };
    }
  }

  async getSummaryAdmin() {
    const [
      totalEvents,
      pageViews,
      tourViews,
      bookingStarted,
      confirmedBookings,
      revenueAgg,
    ] = await Promise.all([
      this.prisma.analyticsEvent.count(),
      this.prisma.analyticsEvent.count({ where: { eventName: 'page_view' } }),
      this.prisma.analyticsEvent.count({ where: { eventName: 'tour_view' } }),
      this.prisma.analyticsEvent.count({
        where: { eventName: 'booking_started' },
      }),
      this.prisma.booking.count({
        where: {
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
          deletedAt: null,
        },
      }),
      this.prisma.booking.aggregate({
        _sum: { totalAmountUsd: true },
        where: {
          status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
          deletedAt: null,
        },
      }),
    ]);

    const totalRevenueUsd = Number(revenueAgg._sum.totalAmountUsd || 0);
    const conversionRate =
      bookingStarted > 0
        ? Number(((confirmedBookings / bookingStarted) * 100).toFixed(2))
        : 0;

    return {
      totalEvents,
      pageViews,
      tourViews,
      bookingStarted,
      confirmedBookings,
      totalRevenueUsd,
      conversionRate,
    };
  }

  async getTimeSeriesAdmin(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        eventName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<
      string,
      { pageViews: number; tourViews: number; bookings: number }
    > = {};

    for (const ev of events) {
      const dateKey = ev.createdAt.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = { pageViews: 0, tourViews: 0, bookings: 0 };
      }
      if (ev.eventName === 'page_view') grouped[dateKey].pageViews += 1;
      if (ev.eventName === 'tour_view') grouped[dateKey].tourViews += 1;
      if (ev.eventName === 'booking_started') grouped[dateKey].bookings += 1;
    }

    return Object.entries(grouped).map(([date, counts]) => ({
      date,
      ...counts,
    }));
  }

  async getTopToursAdmin(limit: number = 10) {
    const topViewed = await this.prisma.analyticsEvent.groupBy({
      by: ['tourSlug'],
      where: {
        eventName: 'tour_view',
        tourSlug: { not: null },
      },
      _count: { tourSlug: true },
      orderBy: { _count: { tourSlug: 'desc' } },
      take: limit,
    });

    return topViewed.map((item) => ({
      tourSlug: item.tourSlug,
      viewsCount: item._count.tourSlug,
    }));
  }

  async getFunnelAdmin(startDate?: string, endDate?: string) {
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const where = {
      createdAt: { gte: start, lte: end },
    };

    const [pageViews, tourViews, bookingStarted, confirmedBookings] =
      await Promise.all([
        this.prisma.analyticsEvent.count({
          where: { ...where, eventName: 'page_view' },
        }),
        this.prisma.analyticsEvent.count({
          where: { ...where, eventName: 'tour_view' },
        }),
        this.prisma.analyticsEvent.count({
          where: { ...where, eventName: 'booking_started' },
        }),
        this.prisma.booking.count({
          where: {
            createdAt: { gte: start, lte: end },
            status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
            deletedAt: null,
          },
        }),
      ]);

    return {
      funnel: [
        { stage: 'PAGE_VIEW', count: pageViews, conversion: 100 },
        {
          stage: 'TOUR_VIEW',
          count: tourViews,
          conversion:
            pageViews > 0
              ? Number(((tourViews / pageViews) * 100).toFixed(2))
              : 0,
        },
        {
          stage: 'BOOKING_STARTED',
          count: bookingStarted,
          conversion:
            tourViews > 0
              ? Number(((bookingStarted / tourViews) * 100).toFixed(2))
              : 0,
        },
        {
          stage: 'BOOKING_CONFIRMED',
          count: confirmedBookings,
          conversion:
            bookingStarted > 0
              ? Number(((confirmedBookings / bookingStarted) * 100).toFixed(2))
              : 0,
        },
      ],
    };
  }
}
