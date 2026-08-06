import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminReportsService {
  private readonly logger = new Logger(AdminReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBookingsTrend(period: string) {
    this.logger.log(`Fetching bookings trend for period: ${period}`);

    // In a real scenario with proper time-series we'd group by month/day.
    // We'll approximate this by pulling all active bookings and grouping in memory,
    // or just return aggregate counts for now.

    const active = { deletedAt: null };
    const [total, pending, completed, cancelled] = await Promise.all([
      this.prisma.booking.count({ where: active }),
      this.prisma.booking.count({
        where: { ...active, status: 'PENDING' },
      }),
      this.prisma.booking.count({
        where: { ...active, status: 'COMPLETED' },
      }),
      this.prisma.booking.count({
        where: { ...active, status: 'CANCELLED' },
      }),
    ]);

    return {
      period,
      total,
      pending,
      completed,
      cancelled,
    };
  }

  async getRevenueTrend(period: string) {
    this.logger.log(`Fetching revenue trend for period: ${period}`);

    const [captured, refunded] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: 'CAPTURED',
          isRefund: false,
          booking: { deletedAt: null },
        },
        _sum: { amount: true },
      }),
      this.prisma.refundRecord.aggregate({
        where: {
          status: 'COMPLETED',
          payment: { booking: { deletedAt: null } },
        },
        _sum: { amount: true },
      }),
    ]);
    const grossRevenue = captured._sum.amount?.toNumber() ?? 0;
    const refunds = refunded._sum.amount?.toNumber() ?? 0;
    const totalRevenue = Math.max(0, grossRevenue - refunds);

    return {
      period,
      totalRevenue,
      grossRevenue,
      refunds,
      currency: 'USD',
    };
  }

  async getDestinationsReport() {
    this.logger.log(`Fetching destinations report`);

    const tours = await this.prisma.tour.findMany({
      select: {
        country: true,
        city: true,
        _count: {
          select: { bookings: true },
        },
      },
    });

    const destinationsMap = new Map<string, number>();

    tours.forEach((t) => {
      const location = `${t.city}, ${t.country}`;
      const count = t._count.bookings;
      destinationsMap.set(
        location,
        (destinationsMap.get(location) || 0) + count,
      );
    });

    const destinations = Array.from(destinationsMap.entries()).map(
      ([location, count]) => ({
        location,
        bookingCount: count,
      }),
    );

    // Sort by most booked
    destinations.sort((a, b) => b.bookingCount - a.bookingCount);

    return { destinations };
  }
}
