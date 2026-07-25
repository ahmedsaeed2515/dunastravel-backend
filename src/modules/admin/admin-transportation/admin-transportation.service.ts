import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransportationBookingStatus } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';

@Injectable()
export class AdminTransportationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pageVal: number = 1, limitVal: number = 10, status?: string) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where = status
      ? { status: status as TransportationBookingStatus }
      : {};

    const [total, records] = await this.prisma.$transaction([
      this.prisma.transportationBooking.count({ where }),
      this.prisma.transportationBooking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { service: true, user: true },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const booking = await this.prisma.transportationBooking.findUnique({
      where: { id },
      include: { service: true, user: true },
    });
    if (!booking)
      throw new NotFoundException('Transportation booking not found');
    return booking;
  }

  async updateStatus(
    id: string,
    status: TransportationBookingStatus,
    actorId?: string,
  ) {
    const booking = await this.findOne(id);
    if (booking.status === status) return booking;

    const validTransitions: Record<string, string[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'QUOTED', 'CANCELLED'],
      UNDER_REVIEW: ['QUOTED', 'AWAITING_PAYMENT', 'CANCELLED'],
      QUOTED: ['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED'],
      AWAITING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['DRIVER_EN_ROUTE', 'PASSENGER_PICKED_UP', 'CANCELLED'],
      DRIVER_EN_ROUTE: ['PASSENGER_PICKED_UP', 'CANCELLED'],
      PASSENGER_PICKED_UP: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
      REFUNDED: [],
    };

    const allowed = validTransitions[booking.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition transportation booking from ${booking.status} to ${status}`,
      );
    }

    const updated = await this.prisma.transportationBooking.update({
      where: { id },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TRANSPORTATION_STATUS_UPDATED',
        entityType: 'TRANSPORTATION_BOOKING',
        entityId: id,
        metadata: {
          oldStatus: booking.status,
          newStatus: status,
        },
      },
    });

    return updated;
  }

  async assignDriver(
    id: string,
    driverName: string,
    vehicleType?: string,
    actorId?: string,
  ) {
    const booking = await this.findOne(id);

    if (driverName || vehicleType) {
      const conflict = await this.prisma.transportationBooking.findFirst({
        where: {
          id: { not: id },
          pickupDate: booking.pickupDate,
          pickupTime: booking.pickupTime,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          OR: [
            ...(driverName ? [{ driverName }] : []),
            ...(vehicleType ? [{ vehicleType }] : []),
          ],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          'Driver or vehicle is already assigned for another transfer at the specified date and time',
        );
      }
    }

    const updated = await this.prisma.transportationBooking.update({
      where: { id },
      data: {
        driverName,
        vehicleType: vehicleType || undefined,
        status: TransportationBookingStatus.ASSIGNED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TRANSPORTATION_DRIVER_ASSIGNED',
        entityType: 'TRANSPORTATION_BOOKING',
        entityId: id,
        metadata: {
          driverName,
          vehicleType,
        },
      },
    });

    return updated;
  }
}
