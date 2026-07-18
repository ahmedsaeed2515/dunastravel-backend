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

    const [total, pending, completed, cancelled] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED' } }),
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

    const completedBookings = await this.prisma.booking.findMany({
      where: { status: 'COMPLETED' },
      select: { totalAmountUsd: true, createdAt: true },
    });

    const totalRevenue = completedBookings.reduce(
      (sum, b) => sum + Number(b.totalAmountUsd),
      0,
    );

    return {
      period,
      totalRevenue,
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
