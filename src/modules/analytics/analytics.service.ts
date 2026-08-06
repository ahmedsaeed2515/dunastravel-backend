import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(dto: TrackEventDto) {
    try {
      const sanitizedProperties = this.sanitizeProperties(dto.properties);
      const referrer = this.sanitizeReferrer(dto.referrer);

      const event = await this.prisma.analyticsEvent.create({
        data: {
          eventId: dto.eventId,
          eventName: dto.eventName,
          sessionId: dto.sessionId || null,
          userId: null,
          interfaceSlug: dto.interfaceSlug || null,
          tourSlug: dto.tourSlug || null,
          bookingRef: dto.bookingRef || null,
          locale: dto.locale || 'en',
          pathname: dto.pathname || null,
          referrer,
          utmSource: dto.utmSource || null,
          utmMedium: dto.utmMedium || null,
          utmCampaign: dto.utmCampaign || null,
          deviceCategory: dto.deviceCategory || 'desktop',
          properties: Object.keys(sanitizedProperties).length
            ? (sanitizedProperties as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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
      return { success: false, error: 'Tracking failed' };
    }
  }

  private sanitizeProperties(
    properties?: Record<string, unknown>,
  ): Record<string, string | number | boolean> {
    if (!properties) return {};

    const safe: Record<string, string | number | boolean> = {};
    const sensitiveKey =
      /email|phone|name|address|password|secret|token|cookie|authorization|passport|card|cvv/i;

    for (const [key, value] of Object.entries(properties).slice(0, 20)) {
      if (
        !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key) ||
        sensitiveKey.test(key)
      ) {
        continue;
      }
      if (typeof value === 'string') {
        safe[key] = value.slice(0, 200);
      } else if (typeof value === 'boolean') {
        safe[key] = value;
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        safe[key] = value;
      }
    }
    return safe;
  }

  private sanitizeReferrer(referrer?: string): string | null {
    if (!referrer) return null;
    try {
      const url = new URL(referrer);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      return `${url.origin}${url.pathname}`.slice(0, 2_048);
    } catch {
      return null;
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
    const { start, end } = this.parseDateRange(startDate, endDate);
    const rows = await this.prisma.$queryRaw<
      Array<{
        day: Date | string;
        pageViews: bigint;
        tourViews: bigint;
        bookings: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        COUNT(*) FILTER (WHERE event_name = 'page_view') AS "pageViews",
        COUNT(*) FILTER (WHERE event_name = 'tour_view') AS "tourViews",
        COUNT(*) FILTER (WHERE event_name = 'booking_started') AS bookings
      FROM analytics_events
      WHERE created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY day
      ORDER BY day ASC
    `;

    return rows.map((row) => ({
      date:
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10),
      pageViews: Number(row.pageViews),
      tourViews: Number(row.tourViews),
      bookings: Number(row.bookings),
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
    const { start, end } = this.parseDateRange(startDate, endDate);

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

  private parseDateRange(
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start > end ||
      end.getTime() - start.getTime() > maxRangeMs
    ) {
      throw new BadRequestException(
        'Analytics date range must be valid and no longer than 366 days',
      );
    }
    return { start, end };
  }
}
