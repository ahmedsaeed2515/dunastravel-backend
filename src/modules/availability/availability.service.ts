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
import { AuthenticatedUser } from '../../common/types';

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
            WHEN status = 'CLOSED' THEN 'CLOSED'
            WHEN LEAST(total_capacity, remaining_seats + ${seatsToRelease}) >= ${LIMITED_CAPACITY_THRESHOLD} THEN 'AVAILABLE'
            WHEN LEAST(total_capacity, remaining_seats + ${seatsToRelease}) > 0 THEN 'LIMITED'
            ELSE 'SOLD_OUT'
          END,
          updated_at = NOW()
      WHERE id = ${availabilityId}
    `;
  }

  async getAvailability(tourSlug: string) {
    const tour = await this.prisma.tour.findFirst({
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

  /** Admin reads include every slot so editors can correct future, closed, and sold-out departures. */
  async listAdminAvailability(tourId: string) {
    const tour = await this.prisma.tour.findFirst({
      where: { id: tourId, deletedAt: null },
      select: { id: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    return this.prisma.tourAvailability.findMany({
      where: { tourId },
      orderBy: { date: 'asc' },
    });
  }

  // ─── Admin Availability Management ─────────────────────────────────────────

  async createAvailability(
    tourId: string,
    dateStr: string,
    totalCapacity: number,
    status: string = 'AVAILABLE',
    actor?: AuthenticatedUser,
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

    const remainingSeats = status === 'SOLD_OUT' ? 0 : totalCapacity;
    const normalizedStatus =
      status === 'CLOSED'
        ? 'CLOSED'
        : remainingSeats === 0
          ? 'SOLD_OUT'
          : remainingSeats < LIMITED_CAPACITY_THRESHOLD
            ? 'LIMITED'
            : 'AVAILABLE';
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.tourAvailability.create({
        data: { tourId, date, totalCapacity, remainingSeats, status: normalizedStatus },
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TOUR_AVAILABILITY_CREATED',
            entityType: 'TOUR_AVAILABILITY',
            entityId: created.id,
            metadata: { tourId, date: date.toISOString(), totalCapacity, status: normalizedStatus },
          },
        });
      }
      return created;
    });
  }

  async createBatchAvailability(
    tourId: string,
    startDateStr: string,
    endDateStr: string,
    totalCapacity: number,
    daysOfWeek?: number[],
    actor?: AuthenticatedUser,
  ) {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');

    const [sy, sm, sd] = String(startDateStr).split('-').map(Number);
    const [ey, em, ed] = String(endDateStr).split('-').map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd));
    const endDate = new Date(Date.UTC(ey, em - 1, ed));
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date format');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
    const calendarDays = Math.floor(
      (Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()) -
        Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())) /
        86_400_000,
    ) + 1;
    if (calendarDays > 366) {
      throw new BadRequestException('Availability batch cannot exceed 366 calendar days');
    }

    const slotDates: Date[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dayOfWeek = curr.getUTCDay(); // 0 = Sun, 1 = Mon ...
      if (!daysOfWeek || daysOfWeek.includes(dayOfWeek)) {
        slotDates.push(new Date(curr));
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.tourAvailability.createMany({
        data: slotDates.map((date) => ({
          tourId,
          date,
          totalCapacity,
          remainingSeats: totalCapacity,
          status: 'AVAILABLE',
        })),
        skipDuplicates: true,
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TOUR_AVAILABILITY_BATCH_CREATED',
            entityType: 'TOUR',
            entityId: tourId,
            metadata: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              requestedSlots: slotDates.length,
              createdSlots: created.count,
              totalCapacity,
            },
          },
        });
      }
      return { count: created.count };
    });
  }

  async updateAvailability(
    id: string,
    dto: {
      totalCapacity?: number;
      remainingSeats?: number;
      status?: string;
      expectedUpdatedAt?: string;
    },
    actor?: AuthenticatedUser,
  ) {
    const slot = await this.prisma.tourAvailability.findUnique({
      where: { id },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    if (
      dto.expectedUpdatedAt &&
      slot.updatedAt.getTime() !== new Date(dto.expectedUpdatedAt).getTime()
    ) {
      throw new ConflictException(
        'This availability slot was changed by another user. Reload it before saving.',
      );
    }

    const totalCapacity = dto.totalCapacity ?? slot.totalCapacity;
    const seatsAlreadyReserved = slot.totalCapacity - slot.remainingSeats;
    if (totalCapacity < seatsAlreadyReserved) {
      throw new ConflictException(
        'Capacity cannot be reduced below seats already reserved for this departure.',
      );
    }
    let remainingSeats =
      dto.remainingSeats ??
      (dto.totalCapacity !== undefined
        ? totalCapacity - seatsAlreadyReserved
        : slot.remainingSeats);

    if (remainingSeats > totalCapacity) {
      remainingSeats = totalCapacity;
    }
    if (remainingSeats < 0) {
      remainingSeats = 0;
    }

    let status = dto.status ?? slot.status;
    if (status === 'CLOSED') {
      // A manual closure remains closed when seats are released later.
      status = 'CLOSED';
    } else if (remainingSeats === 0) {
      status = 'SOLD_OUT';
    } else {
      status =
        remainingSeats < LIMITED_CAPACITY_THRESHOLD ? 'LIMITED' : 'AVAILABLE';
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tourAvailability.update({
        where: { id },
        data: { totalCapacity, remainingSeats, status },
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TOUR_AVAILABILITY_UPDATED',
            entityType: 'TOUR_AVAILABILITY',
            entityId: id,
            metadata: {
              before: {
                totalCapacity: slot.totalCapacity,
                remainingSeats: slot.remainingSeats,
                status: slot.status,
              },
              after: { totalCapacity, remainingSeats, status },
            },
          },
        });
      }
      return updated;
    });
  }

  async deleteAvailability(id: string, actor?: AuthenticatedUser) {
    const slot = await this.prisma.tourAvailability.findUnique({
      where: { id },
    });
    if (!slot) throw new NotFoundException('Availability slot not found');

    const bookingCount = await this.prisma.booking.count({
      where: { availabilityId: id },
    });
    if (bookingCount > 0) {
      throw new ConflictException(
        'Availability with booking history cannot be deleted. Close it instead.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tourAvailability.delete({ where: { id } });
      if (actor) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TOUR_AVAILABILITY_DELETED',
            entityType: 'TOUR_AVAILABILITY',
            entityId: id,
            metadata: { tourId: slot.tourId, date: slot.date.toISOString() },
          },
        });
      }
    });
    return { success: true };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredHolds(holdDurationMinutes: number = 15): Promise<number> {
    const cutoffDate = new Date(Date.now() - holdDurationMinutes * 60 * 1000);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const expiredBookings = await tx.booking.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: cutoffDate },
          availabilityId: { not: null },
          // Never release a booking while its hosted checkout is still valid.
          // PayLink's authoritative expires_at wins over the generic hold TTL.
          payments: {
            none: {
              status: 'PENDING',
              isRefund: false,
              OR: [
                { expiresAt: { gt: now } },
                { expiresAt: null, createdAt: { gte: cutoffDate } },
              ],
            },
          },
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

            // Void open invoices
            if (tx.invoice) {
              await tx.invoice.updateMany({
                where: {
                  bookingId: booking.id,
                  status: { in: ['SENT', 'DRAFT'] },
                },
                data: { status: 'VOID' },
              });
            }

            // Reverse promotion redemptions
            if (tx.promotionRedemption) {
              const redemptions = await tx.promotionRedemption.findMany({
                where: {
                  bookingId: booking.id,
                  status: { in: ['APPLIED', 'ACTIVE'] },
                },
                select: { id: true, promotionId: true },
              });

              for (const redemption of redemptions) {
                await tx.promotionRedemption.update({
                  where: { id: redemption.id },
                  data: { status: 'REVERSED', reversedAt: new Date() },
                });
                if (tx.promotion) {
                  await tx.promotion.update({
                    where: { id: redemption.promotionId },
                    data: { currentUses: { decrement: 1 } },
                  });
                }
              }
            }

            releasedCount++;
          }
        }
      }
      return releasedCount;
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async extendAllToursRollingAvailability(): Promise<void> {
    const activeTours = await this.prisma.tour.findMany({
      where: { isActive: true, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    const slotDates: Date[] = [];
    for (let i = 0; i < 365; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      slotDates.push(d);
    }

    for (const tour of activeTours) {
      try {
        await this.prisma.tourAvailability.createMany({
          data: slotDates.map((date) => ({
            tourId: tour.id,
            date,
            totalCapacity: 25,
            remainingSeats: 25,
            status: 'AVAILABLE',
          })),
          skipDuplicates: true,
        });
      } catch {
        // Non-blocking
      }
    }
  }
}
