import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransportationBookingDto } from './dto/create-transportation-booking.dto';
import { generateReferenceCode } from '../../common/utils';
import { Prisma } from '@prisma/client';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';
import crypto from 'crypto';

@Injectable()
export class TransportationService {
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

  async createBooking(
    userId: string | null,
    dto: CreateTransportationBookingDto,
    idempotencyKey?: string,
  ) {
    if (
      !userId ||
      !idempotencyKey ||
      idempotencyKey.length > 100 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(idempotencyKey)
    ) {
      throw new BadRequestException('A valid Idempotency-Key is required');
    }
    const requestHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          serviceId: dto.serviceId,
          pickupDate: dto.pickupDate,
          pickupTime: dto.pickupTime || null,
          pickupLocation: dto.pickupLocation.trim(),
          dropoffLocation: dto.dropoffLocation.trim(),
          passengerCount: dto.passengerCount,
          luggageCount: dto.luggageCount || 0,
          flightNumber: dto.flightNumber?.trim().toUpperCase() || null,
          notes: dto.notes?.trim() || null,
        }),
      )
      .digest('hex');

    const existing = await this.prisma.transportationBooking.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key was reused with a different request',
        );
      }
      return this.toSafeBooking(existing);
    }

    const service = await this.prisma.transportationService.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException(
        'Transportation service not found or inactive',
      );
    }
    if (service.capacity !== null && dto.passengerCount > service.capacity) {
      throw new BadRequestException(
        `Passenger count exceeds this service capacity of ${service.capacity}`,
      );
    }

    const pickupDate = new Date(dto.pickupDate);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const latestAllowed = new Date(today);
    latestAllowed.setUTCFullYear(latestAllowed.getUTCFullYear() + 2);
    if (pickupDate < today || pickupDate > latestAllowed) {
      throw new BadRequestException(
        'Pickup date is outside the allowed booking window',
      );
    }

    const multiplier = new Prisma.Decimal(1).add(
      new Prisma.Decimal(0.2).mul(dto.passengerCount - 1),
    );
    const totalAmount = service.basePriceUsd
      .mul(multiplier)
      .toDecimalPlaces(2);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const created = await this.prisma.transportationBooking.create({
          data: {
            referenceCode: generateReferenceCode('TR'),
            serviceId: service.id,
            userId,
            pickupDate,
            pickupTime: dto.pickupTime,
            pickupLocation: sanitizePlainText(dto.pickupLocation).slice(0, 255),
            dropoffLocation: sanitizePlainText(dto.dropoffLocation).slice(
              0,
              255,
            ),
            passengerCount: dto.passengerCount,
            luggageCount: dto.luggageCount || 0,
            flightNumber: dto.flightNumber
              ? sanitizePlainText(dto.flightNumber)
                  .slice(0, 20)
                  .toUpperCase()
              : null,
            notes: dto.notes
              ? sanitizePlainText(dto.notes).slice(0, 2_000)
              : null,
            totalAmountUsd: totalAmount,
            status: 'SUBMITTED',
            idempotencyKey,
            requestHash,
          },
        });
        return this.toSafeBooking(created);
      } catch (error: unknown) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const winner = await this.prisma.transportationBooking.findUnique({
          where: {
            userId_idempotencyKey: { userId, idempotencyKey },
          },
        });
        if (winner) {
          if (winner.requestHash !== requestHash) {
            throw new ConflictException(
              'Idempotency key was reused with a different request',
            );
          }
          return this.toSafeBooking(winner);
        }
      }
    }
    throw new ConflictException(
      'Transportation booking could not be created safely; retry with the same key',
    );
  }

  async findAllServices() {
    const services = await this.prisma.transportationService.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
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
        features: Array.isArray(service.featuresJsonb) ? service.featuresJsonb.filter((item): item is string => typeof item === 'string') : [],
        heroImageUrl: hero?.secureUrl || hero?.url || service.heroImageUrl || null,
        heroImageAlt: hero?.altText || null,
      };
    });
  }

  async findUserBookings(userId: string) {
    const bookings = await this.prisma.transportationBooking.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => this.toSafeBooking(booking));
  }
}
