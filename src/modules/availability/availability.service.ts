import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export const LIMITED_CAPACITY_THRESHOLD = 10;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveCapacity(
    tx: Prisma.TransactionClient | PrismaService,
    availabilityId: string,
    seatsRequired: number,
  ): Promise<void> {
    if (seatsRequired <= 0) return;

    const count = await tx.$executeRaw`
      UPDATE tour_availabilities
      SET remaining_seats = remaining_seats - ${seatsRequired},
          status = CASE
            WHEN (remaining_seats - ${seatsRequired}) = 0 THEN 'SOLD_OUT'
            WHEN (remaining_seats - ${seatsRequired}) < ${LIMITED_CAPACITY_THRESHOLD} THEN 'LIMITED'
            ELSE 'AVAILABLE'
          END,
          updated_at = NOW()
      WHERE id = ${availabilityId}
        AND remaining_seats >= ${seatsRequired}
        AND status IN ('AVAILABLE', 'LIMITED')
    `;

    const rowsAffected = typeof count === 'number' ? count : Number(count);
    if (rowsAffected === 0) {
      throw new UnprocessableEntityException(
        'Availability slot is fully booked or no longer available',
      );
    }
  }

  async releaseCapacity(
    tx: Prisma.TransactionClient | PrismaService,
    availabilityId: string,
    seatsToRelease: number,
  ): Promise<void> {
    if (seatsToRelease <= 0 || !availabilityId) return;

    await tx.$executeRaw`
      UPDATE tour_availabilities
      SET remaining_seats = LEAST(total_capacity, remaining_seats + ${seatsToRelease}),
          status = CASE
            WHEN LEAST(total_capacity, remaining_seats + ${seatsToRelease}) >= ${LIMITED_CAPACITY_THRESHOLD} THEN 'AVAILABLE'
            WHEN LEAST(total_capacity, remaining_seats + ${seatsToRelease}) > 0 THEN 'LIMITED'
            ELSE 'SOLD_OUT'
          END,
          updated_at = NOW()
      WHERE id = ${availabilityId}
    `;
  }

  async getAvailability(tourSlug: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { slug: tourSlug, status: 'PUBLISHED', isActive: true },
      select: { id: true, titleJsonb: true },
    });

    if (!tour) throw new BadRequestException('Tour not found');

    const availabilities = await this.prisma.tourAvailability.findMany({
      where: {
        tourId: tour.id,
        date: { gte: new Date() },
        status: { in: ['AVAILABLE', 'LIMITED'] },
      },
      orderBy: { date: 'asc' },
    });

    return { tour, availabilities };
  }

  // ─── Admin Availability Management ─────────────────────────────────────────

  async createAvailability(
    tourId: string,
    dateStr: string,
    totalCapacity: number = 30,
    status: string = 'AVAILABLE',
  ) {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const existing = await this.prisma.tourAvailability.findUnique({
      where: { tourId_date: { tourId, date } },
    });
    if (existing) {
      throw new ConflictException(
        'Availability for this tour and date already exists',
      );
    }

    return this.prisma.tourAvailability.create({
      data: {
        tourId,
        date,
        totalCapacity,
        remainingSeats: totalCapacity,
        status,
      },
    });
  }

  async createBatchAvailability(
    tourId: string,
    startDateStr: string,
    endDateStr: string,
    totalCapacity: number = 30,
    daysOfWeek?: number[],
  ) {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const createdSlots = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dayOfWeek = curr.getDay(); // 0 = Sun, 1 = Mon ...
      if (!daysOfWeek || daysOfWeek.includes(dayOfWeek)) {
        const slotDate = new Date(curr);
        try {
          const slot = await this.prisma.tourAvailability.upsert({
            where: { tourId_date: { tourId, date: slotDate } },
            update: {
              totalCapacity,
              remainingSeats: totalCapacity,
              status: 'AVAILABLE',
            },
            create: {
              tourId,
              date: slotDate,
              totalCapacity,
              remainingSeats: totalCapacity,
              status: 'AVAILABLE',
            },
          });
          createdSlots.push(slot);
        } catch {
          // Ignore duplicate conflict in batch loop
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    return { count: createdSlots.length, slots: createdSlots };
  }

  async updateAvailability(
    id: string,
    dto: { totalCapacity?: number; remainingSeats?: number; status?: string },
  ) {
    const slot = await this.prisma.tourAvailability.findUnique({
      where: { id },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    const totalCapacity = dto.totalCapacity ?? slot.totalCapacity;
    let remainingSeats = dto.remainingSeats ?? slot.remainingSeats;

    if (remainingSeats > totalCapacity) {
      remainingSeats = totalCapacity;
    }
    if (remainingSeats < 0) {
      remainingSeats = 0;
    }

    let status = dto.status ?? slot.status;
    if (remainingSeats === 0) {
      status = 'SOLD_OUT';
    } else if (
      remainingSeats < LIMITED_CAPACITY_THRESHOLD &&
      status === 'AVAILABLE'
    ) {
      status = 'LIMITED';
    }

    return this.prisma.tourAvailability.update({
      where: { id },
      data: {
        totalCapacity,
        remainingSeats,
        status,
      },
    });
  }

  async deleteAvailability(id: string) {
    const slot = await this.prisma.tourAvailability.findUnique({
      where: { id },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    await this.prisma.tourAvailability.delete({ where: { id } });
    return { success: true };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredHolds(holdDurationMinutes: number = 15): Promise<number> {
    const cutoffDate = new Date(Date.now() - holdDurationMinutes * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const expiredBookings = await tx.booking.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: cutoffDate },
          availabilityId: { not: null },
        },
      });

      let releasedCount = 0;
      for (const booking of expiredBookings) {
        if (booking.availabilityId) {
          const totalPax = (booking.adults || 1) + (booking.children || 0);
          const updateResult = await tx.booking.updateMany({
            where: { id: booking.id, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });

          if (updateResult.count > 0) {
            await this.releaseCapacity(tx, booking.availabilityId, totalPax);
            releasedCount++;
          }
        }
      }
      return releasedCount;
    });
  }
}

