import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminReportsService {
  private readonly logger = new Logger(AdminReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getDatesForPeriod(period?: string): {
    from: Date;
    to: Date;
    trunc: string;
  } {
    const to = new Date();
    const from = new Date();
    let trunc = 'month';

    switch (period?.toLowerCase()) {
      case 'daily':
      case 'day':
      case '7d':
        from.setDate(to.getDate() - 7);
        trunc = 'day';
        break;
      case 'weekly':
      case '30d':
      case '1m':
        from.setDate(to.getDate() - 30);
        trunc = 'day';
        break;
      case '90d':
      case '3m':
        from.setDate(to.getDate() - 90);
        trunc = 'week';
        break;
      case 'yearly':
      case '1y':
        from.setFullYear(to.getFullYear() - 1);
        trunc = 'month';
        break;
      case 'monthly':
      default:
        from.setMonth(to.getMonth() - 12);
        trunc = 'month';
        break;
    }

    return { from, to, trunc };
  }

  async getBookingsTrend(period: string = 'monthly') {
    this.logger.log(`Fetching bookings trend for period: ${period}`);
    const { from, to, trunc } = this.getDatesForPeriod(period);

    const truncSql =
      trunc === 'day'
        ? Prisma.sql`DATE_TRUNC('day', p."paid_at")`
        : trunc === 'week'
          ? Prisma.sql`DATE_TRUNC('week', p."paid_at")`
          : Prisma.sql`DATE_TRUNC('month', p."paid_at")`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        total: bigint;
        confirmed: bigint;
        pending: bigint;
        completed: bigint;
        cancelled: bigint;
      }>
    >(Prisma.sql`
      SELECT
        ${truncSql} AS "period",
        COUNT(*) AS "total",
        COUNT(*) FILTER (WHERE b.status::text IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID')) AS "confirmed",
        COUNT(*) FILTER (WHERE b.status::text = 'PENDING') AS "pending",
        COUNT(*) FILTER (WHERE b.status::text = 'COMPLETED') AS "completed",
        COUNT(*) FILTER (WHERE b.status::text = 'CANCELLED') AS "cancelled"
      FROM "bookings" b
      WHERE b."created_at" >= ${from}
        AND b."created_at" <= ${to}
        AND b."deleted_at" IS NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return rows.map((row) => ({
      period: row.period.toISOString(),
      total: Number(row.total),
      confirmed: Number(row.confirmed),
      pending: Number(row.pending),
      completed: Number(row.completed),
      cancelled: Number(row.cancelled),
    }));
  }

  async getRevenueTrend(period: string = 'monthly') {
    this.logger.log(`Fetching revenue trend for period: ${period}`);
    const { from, to, trunc } = this.getDatesForPeriod(period);

    const truncSql =
      trunc === 'day'
        ? Prisma.sql`DATE_TRUNC('day', p."paid_at")`
      : trunc === 'week'
          ? Prisma.sql`DATE_TRUNC('week', p."paid_at")`
          : Prisma.sql`DATE_TRUNC('month', p."paid_at")`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        period: Date;
        grossRevenue: Prisma.Decimal;
        collectedRevenue: Prisma.Decimal;
        bookingsCount: bigint;
      }>
    >(Prisma.sql`
      SELECT
        ${truncSql} AS "period",
        COALESCE(SUM(p."amount"), 0) AS "grossRevenue",
        COALESCE(SUM(p."amount"), 0) - COALESCE((
          SELECT SUM(r."amount")
          FROM "refund_records" r
          WHERE r.status::text = 'COMPLETED'
            AND DATE_TRUNC(${trunc}, r."created_at") = ${truncSql}
        ), 0) AS "collectedRevenue",
        COUNT(DISTINCT p."booking_id") AS "bookingsCount"
      FROM "payments" p
      WHERE p."paid_at" >= ${from}
        AND p."paid_at" <= ${to}
        AND p."is_refund" = false
        AND p.status::text IN ('CAPTURED', 'REFUND_PENDING', 'REFUNDED')
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return rows.map((row) => ({
      period: row.period.toISOString(),
      grossRevenue: Number(row.grossRevenue),
      totalRevenue: Number(row.collectedRevenue),
      collectedRevenue: Number(row.collectedRevenue),
      bookingsCount: Number(row.bookingsCount),
      currency: 'USD',
    }));
  }

  async getDestinationsReport() {
    this.logger.log(`Fetching destinations report`);

    const tours = await this.prisma.tour.findMany({
      where: { deletedAt: null },
      select: {
        country: true,
        city: true,
        _count: {
          select: { bookings: true },
        },
      },
    });

    const destinationsMap = new Map<
      string,
      {
        location: string;
        country: string | null;
        city: string | null;
        bookingCount: number;
        tourCount: number;
      }
    >();

    tours.forEach((t) => {
      const country = t.country?.trim() || null;
      const city = t.city?.trim() || null;
      const location = [city, country].filter(Boolean).join(', ');
      if (!location) return;

      const key = `${city ?? ''}|${country ?? ''}`.toLocaleLowerCase();
      const current = destinationsMap.get(key);
      destinationsMap.set(key, {
        location,
        country,
        city,
        bookingCount: (current?.bookingCount ?? 0) + t._count.bookings,
        tourCount: (current?.tourCount ?? 0) + 1,
      });
    });

    const destinations = Array.from(destinationsMap.values());

    // Sort by most booked
    destinations.sort((a, b) => b.bookingCount - a.bookingCount);

    return destinations;
  }
}
