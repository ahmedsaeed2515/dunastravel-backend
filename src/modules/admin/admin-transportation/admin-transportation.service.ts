import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransportationBookingStatus } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
import { sanitizePlainText } from '../../../common/utils/content-sanitizer.util';
import { AuthenticatedUser } from '../../../common/types';
import {
  CreateTransportationServiceDto,
  UpdateTransportationServiceDto,
} from './dto/admin-transportation.dto';

@Injectable()
export class AdminTransportationService {
  constructor(private readonly prisma: PrismaService) {}

  private toSafeBooking<
    T extends { idempotencyKey: string | null; requestHash: string | null },
  >(booking: T): Omit<T, 'idempotencyKey' | 'requestHash'> {
    const {
      idempotencyKey: _idempotencyKey,
      requestHash: _requestHash,
      ...safe
    } = booking;
    return safe;
  }

  async findAllServices() {
    return this.prisma.transportationService.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createService(
    dto: CreateTransportationServiceDto,
    actor?: AuthenticatedUser,
  ) {
    const service = await this.prisma.transportationService.create({
      data: {
        name: sanitizePlainText(dto.name).slice(0, 255),
        serviceType: sanitizePlainText(dto.serviceType).slice(0, 50),
        basePriceUsd: dto.basePriceUsd,
        isActive: dto.isActive ?? true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorRole: actor?.role || null,
        action: 'TRANSPORTATION_SERVICE_CREATED',
        entityType: 'TRANSPORTATION_SERVICE',
        entityId: service.id,
      },
    });
    return service;
  }

  async updateService(
    id: string,
    dto: UpdateTransportationServiceDto,
    actor?: AuthenticatedUser,
  ) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Transportation service not found');
    const service = await this.prisma.transportationService.update({
      where: { id },
      data: {
        ...(dto.name !== undefined
          ? { name: sanitizePlainText(dto.name).slice(0, 255) }
          : {}),
        ...(dto.serviceType !== undefined
          ? { serviceType: sanitizePlainText(dto.serviceType).slice(0, 50) }
          : {}),
        ...(dto.basePriceUsd !== undefined ? { basePriceUsd: dto.basePriceUsd } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorRole: actor?.role || null,
        action: 'TRANSPORTATION_SERVICE_UPDATED',
        entityType: 'TRANSPORTATION_SERVICE',
        entityId: id,
      },
    });
    return service;
  }

  async deactivateService(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Transportation service not found');
    const service = await this.prisma.transportationService.update({
      where: { id },
      data: { isActive: false },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorRole: actor?.role || null,
        action: 'TRANSPORTATION_SERVICE_DEACTIVATED',
        entityType: 'TRANSPORTATION_SERVICE',
        entityId: id,
      },
    });
    return service;
  }

  async findAll(
    pageVal: number = 1,
    limitVal: number = 10,
    status?: TransportationBookingStatus,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where = status ? { status } : {};

    const [total, records] = await this.prisma.$transaction([
      this.prisma.transportationBooking.count({ where }),
      this.prisma.transportationBooking.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          service: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    return paginate(
      records.map((record) => this.toSafeBooking(record)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string) {
    const booking = await this.prisma.transportationBooking.findUnique({
      where: { id },
      include: {
        service: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!booking)
      throw new NotFoundException('Transportation booking not found');
    return this.toSafeBooking(booking);
  }

  async updateStatus(
    id: string,
    status: TransportationBookingStatus,
    actor?: AuthenticatedUser,
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

    return this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.transportationBooking.updateMany({
          where: { id, status: booking.status },
          data: { status },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Transportation booking was modified concurrently',
          );
        }
        await tx.auditLog.create({
          data: {
            actorId: actor?.id || null,
            actorRole: actor?.role || null,
            action: 'TRANSPORTATION_STATUS_UPDATED',
            entityType: 'TRANSPORTATION_BOOKING',
            entityId: id,
            metadata: {
              oldStatus: booking.status,
              newStatus: status,
            },
          },
        });
        const updated = await tx.transportationBooking.findUniqueOrThrow({
          where: { id },
        });
        return this.toSafeBooking(updated);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async assignDriver(
    id: string,
    driverName: string,
    vehicleType?: string,
    actor?: AuthenticatedUser,
  ) {
    const booking = await this.findOne(id);
    if (!['CONFIRMED', 'ASSIGNED'].includes(booking.status)) {
      throw new BadRequestException(
        'A driver can only be assigned to a confirmed booking',
      );
    }
    const safeDriverName = sanitizePlainText(driverName).slice(0, 100);
    const safeVehicleType = vehicleType
      ? sanitizePlainText(vehicleType).slice(0, 100)
      : undefined;
    if (!safeDriverName) {
      throw new BadRequestException('Driver name is required');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.transportationBooking.findFirst({
          where: {
            id: { not: id },
            pickupDate: booking.pickupDate,
            pickupTime: booking.pickupTime,
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            OR: [
              { driverName: safeDriverName },
              ...(safeVehicleType ? [{ vehicleType: safeVehicleType }] : []),
            ],
          },
        });

        if (conflict) {
          throw new BadRequestException(
            'Driver or vehicle is already assigned for another transfer at the specified date and time',
          );
        }

        const claimed = await tx.transportationBooking.updateMany({
          where: { id, status: booking.status },
          data: {
            driverName: safeDriverName,
            vehicleType: safeVehicleType,
            status: TransportationBookingStatus.ASSIGNED,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Transportation booking was modified concurrently',
          );
        }

        await tx.auditLog.create({
          data: {
            actorId: actor?.id || null,
            actorRole: actor?.role || null,
            action: 'TRANSPORTATION_DRIVER_ASSIGNED',
            entityType: 'TRANSPORTATION_BOOKING',
            entityId: id,
            metadata: { changedFields: ['driverName', 'vehicleType', 'status'] },
          },
        });
        const updated = await tx.transportationBooking.findUniqueOrThrow({
          where: { id },
        });
        return this.toSafeBooking(updated);
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
