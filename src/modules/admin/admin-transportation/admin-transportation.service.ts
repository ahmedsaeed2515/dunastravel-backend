import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransportationBookingStatus } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
import { sanitizePlainText } from '../../../common/utils/content-sanitizer.util';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../../common/types';
import {
  CreateTransportationServiceDto,
  UpdateTransportationServiceDto,
} from './dto/admin-transportation.dto';
import { CANONICAL_FLEET } from '../../transportation/constants/canonical-fleet.constant';

@Injectable()
export class AdminTransportationService {
  private readonly logger = new Logger(AdminTransportationService.name);

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

  private serviceData(
    dto: CreateTransportationServiceDto | UpdateTransportationServiceDto,
  ): Prisma.TransportationServiceUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = sanitizePlainText(dto.name).slice(0, 255);
    if (dto.serviceType !== undefined) data.serviceType = sanitizePlainText(dto.serviceType).slice(0, 50);
    if (dto.description !== undefined) data.description = sanitizePlainText(dto.description).slice(0, 10_000) || null;
    if (dto.vehicleCategory !== undefined) data.vehicleCategory = sanitizePlainText(dto.vehicleCategory).slice(0, 50) || null;
    if (dto.vehicleType !== undefined) data.vehicleType = sanitizePlainText(dto.vehicleType).slice(0, 100) || null;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.doors !== undefined) data.doors = dto.doors;
    if (dto.transmission !== undefined) data.transmission = sanitizePlainText(dto.transmission).slice(0, 50) || null;
    if (dto.heroImageUrl !== undefined) data.heroImageUrl = sanitizePlainText(dto.heroImageUrl).slice(0, 2_048) || null;
    if (dto.isPrivate !== undefined) data.isPrivate = dto.isPrivate;
    if (dto.pickupInstructions !== undefined) data.pickupInstructions = sanitizePlainText(dto.pickupInstructions).slice(0, 10_000) || null;
    if (dto.dropoffInstructions !== undefined) data.dropoffInstructions = sanitizePlainText(dto.dropoffInstructions).slice(0, 10_000) || null;
    if (dto.features !== undefined) data.featuresJsonb = dto.features.map((value) => sanitizePlainText(value).slice(0, 100)).filter(Boolean) as Prisma.InputJsonValue;
    if (dto.heroMediaId !== undefined) data.heroMediaId = dto.heroMediaId ? dto.heroMediaId.trim() : null;
    if (dto.basePriceUsd !== undefined) data.basePriceUsd = dto.basePriceUsd;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data as Prisma.TransportationServiceUncheckedCreateInput;
  }

  async findAllServices() {
    try {
      let services = await this.prisma.transportationService.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      });

      if (services.length === 0) {
        try {
          await this.autoSeedCanonicalFleet();
          services = await this.prisma.transportationService.findMany({
            orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
          });
        } catch (seedErr) {
          this.logger.warn('Admin auto-seed transportation fleet failed', seedErr);
        }
      }

      const mediaIds = services.flatMap((service) => service.heroMediaId ? [service.heroMediaId] : []);
      const media = mediaIds.length
        ? await this.prisma.mediaAsset.findMany({
            where: { id: { in: mediaIds }, deletedAt: null },
            select: { id: true, secureUrl: true, url: true, altText: true },
          })
        : [];
      const mediaById = new Map(media.map((asset) => [asset.id, asset]));
      return services.map((service) => {
        const hero = service.heroMediaId ? mediaById.get(service.heroMediaId) : undefined;
        return {
          ...service,
          basePriceUsd: Number(service.basePriceUsd),
          features: Array.isArray(service.featuresJsonb)
            ? service.featuresJsonb.filter((item): item is string => typeof item === 'string')
            : [],
          heroImageUrl: hero?.secureUrl || hero?.url || service.heroImageUrl || null,
          heroImageAlt: hero?.altText || null,
        };
      });
    } catch (err) {
      this.logger.error('Failed to fetch transportation services from DB', err);
      return [];
    }
  }

  private async autoSeedCanonicalFleet(): Promise<void> {
    for (const vehicle of CANONICAL_FLEET) {
      await this.prisma.transportationService.upsert({
        where: { id: vehicle.id },
        create: {
          id: vehicle.id,
          name: vehicle.name,
          serviceType: vehicle.serviceType,
          vehicleCategory: vehicle.vehicleCategory,
          vehicleType: vehicle.vehicleType,
          capacity: vehicle.capacity,
          doors: vehicle.doors,
          transmission: vehicle.transmission,
          basePriceUsd: vehicle.basePriceUsd,
          heroImageUrl: vehicle.heroImageUrl,
          isPrivate: vehicle.isPrivate,
          isActive: vehicle.isActive,
          featuresJsonb: vehicle.featuresJsonb,
          description: vehicle.description,
        },
        update: {},
      });
    }
  }

  async createService(
    dto: CreateTransportationServiceDto,
    actor?: AuthenticatedUser,
  ) {
    const service = await this.prisma.transportationService.create({
      data: {
        ...this.serviceData(dto),
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
    const data = this.serviceData(dto);
    const service = await this.prisma.transportationService.upsert({
      where: { id },
      create: {
        basePriceUsd: 0,
        isActive: true,
        ...data,
        name: (data.name as string) || 'Transportation Service',
        serviceType: (data.serviceType as string) || 'AIRPORT',
        id,
      },
      update: data,
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
