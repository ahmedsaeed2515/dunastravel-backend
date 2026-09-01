import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransportationBookingDto } from './dto/create-transportation-booking.dto';
import {
  CreateTransportationServiceDto,
  UpdateTransportationServiceDto,
  QueryTransportationServiceDto,
  UpdateTransportationBookingStatusDto,
} from './dto/transportation-service.dto';
import { generateReferenceCode } from '../../common/utils';
import { Prisma } from '@prisma/client';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';
import { CANONICAL_FLEET } from './constants/canonical-fleet.constant';
import crypto from 'crypto';

@Injectable()
export class TransportationService {
  private readonly logger = new Logger(TransportationService.name);

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

  /**
   * Helper to resolve 5-language localized names, descriptions, features, and media asset URLs.
   */
  private resolveLocalizedService(service: any, locale = 'en', mediaById?: Map<string, any>) {
    const jsonb = (service.featuresJsonb && typeof service.featuresJsonb === 'object' && !Array.isArray(service.featuresJsonb))
      ? service.featuresJsonb
      : {};

    const nameJsonb = jsonb.nameJsonb || service.nameJsonb || {
      en: service.name,
      ar: service.name,
      es: service.name,
      pt: service.name,
      it: service.name,
    };

    const descriptionJsonb = jsonb.descriptionJsonb || service.descriptionJsonb || {
      en: service.description || '',
      ar: service.description || '',
      es: service.description || '',
      pt: service.description || '',
      it: service.description || '',
    };

    const rawFeatures = Array.isArray(service.featuresJsonb)
      ? service.featuresJsonb
      : Array.isArray(jsonb.features)
      ? jsonb.features
      : Array.isArray(service.features)
      ? service.features
      : [];

    const localizedName = nameJsonb[locale] || nameJsonb.en || nameJsonb.ar || service.name;
    const localizedDescription = descriptionJsonb[locale] || descriptionJsonb.en || descriptionJsonb.ar || service.description || '';

    const hero = service.heroMediaId && mediaById ? mediaById.get(service.heroMediaId) : undefined;
    const resolvedHeroUrl = hero?.secureUrl || hero?.url || service.heroImageUrl || this.getFallbackVehicleImage(service.vehicleCategory);

    const rating = service.rating || jsonb.rating || 5.0;
    const reviews = service.reviews || jsonb.reviews || 120;
    const seats = service.capacity || (service.vehicleCategory === 'private' ? 4 : service.vehicleCategory === 'coaster' ? 24 : 50);

    return {
      ...service,
      name: localizedName,
      nameAr: nameJsonb.ar || service.name,
      nameEn: nameJsonb.en || service.name,
      nameJsonb,
      description: localizedDescription,
      descriptionJsonb,
      basePriceUsd: Number(service.basePriceUsd),
      features: rawFeatures.filter((item: any): item is string => typeof item === 'string'),
      featuresJsonb: rawFeatures,
      heroImageUrl: resolvedHeroUrl,
      image: resolvedHeroUrl,
      heroImageAlt: hero?.altText || null,
      rating,
      reviews,
      seats,
      doors: service.doors || (service.vehicleCategory === 'private' ? 4 : 2),
      transmission: service.transmission || 'Auto',
      isArchived: Boolean(jsonb.isArchived) || !service.isActive,
    };
  }

  private getFallbackVehicleImage(category?: string | null): string {
    const cat = (category || 'bus').toLowerCase();
    if (cat === 'coaster') return '/imgs/transportation/costar.jpeg';
    if (cat === 'private' || cat === 'transfer' || cat === 'sedan' || cat === 'suv') return '/imgs/transportation/privte.jpeg';
    return '/imgs/transportation/bus1.jpeg';
  }

  async createBooking(
    userId: string | null,
    dto: CreateTransportationBookingDto,
    idempotencyKey?: string,
  ) {
    const effectiveKey = idempotencyKey || crypto.randomUUID();
    if (
      effectiveKey.length > 100 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(effectiveKey)
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

    const existing = await this.prisma.transportationBooking.findFirst({
      where: {
        userId: userId || null,
        idempotencyKey: effectiveKey,
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
            idempotencyKey: effectiveKey,
            requestHash,
          },
        });
        return this.toSafeBooking(created);
      } catch (error: unknown) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const winner = await this.prisma.transportationBooking.findFirst({
          where: {
            userId: userId || null,
            idempotencyKey: effectiveKey,
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

  // ------------------------------------------------------
  // PUBLIC FLEET SERVICES
  // ------------------------------------------------------
  async findAllServices(locale = 'en') {
    let services = await this.prisma.transportationService.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (services.length === 0) {
      try {
        await this.autoSeedCanonicalFleet();
        services = await this.prisma.transportationService.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        });
      } catch (err) {
        this.logger.warn('Auto-seed transportation fleet failed, using in-memory canonical fleet', err);
        return CANONICAL_FLEET.filter((v) => v.isActive).map((v) => ({
          ...v,
          basePriceUsd: v.basePriceUsd,
          features: v.featuresJsonb,
          heroImageAlt: null,
          heroMediaId: null,
          pickupInstructions: null,
          dropoffInstructions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      }
    }

    const mediaIds = services.flatMap((service) => (service.heroMediaId ? [service.heroMediaId] : []));
    const media = mediaIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: mediaIds }, deletedAt: null },
          select: { id: true, secureUrl: true, url: true, altText: true },
        })
      : [];
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));

    return services.map((service) => this.resolveLocalizedService(service, locale, mediaById));
  }

  async findOnePublic(id: string, locale = 'en') {
    const service = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!service || !service.isActive) {
      throw new NotFoundException(`Transportation service "${id}" not found`);
    }
    const media = service.heroMediaId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: service.heroMediaId },
          select: { id: true, secureUrl: true, url: true, altText: true },
        })
      : null;
    const mediaById = media ? new Map([[media.id, media]]) : new Map();
    return this.resolveLocalizedService(service, locale, mediaById);
  }

  // ------------------------------------------------------
  // ADMIN FLEET CRUD & LIFECYCLE
  // ------------------------------------------------------
  async findAllAdmin(query: QueryTransportationServiceDto) {
    const { page = 1, limit = 50, search, category, serviceType, status, locale = 'en' } = query;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

    const where: Prisma.TransportationServiceWhereInput = {};

    if (status === 'ACTIVE') {
      where.isActive = true;
    } else if (status === 'INACTIVE' || status === 'ARCHIVED') {
      where.isActive = false;
    }

    if (category && category !== 'ALL') {
      where.vehicleCategory = { equals: category, mode: 'insensitive' };
    }

    if (serviceType && serviceType !== 'ALL') {
      where.serviceType = { equals: serviceType, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { vehicleType: { contains: q, mode: 'insensitive' } },
      ];
    }

    let [total, services] = await Promise.all([
      this.prisma.transportationService.count({ where }),
      this.prisma.transportationService.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (total === 0 && (!search && !category && !serviceType && (!status || status === 'ALL'))) {
      try {
        await this.autoSeedCanonicalFleet();
        [total, services] = await Promise.all([
          this.prisma.transportationService.count({ where }),
          this.prisma.transportationService.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
          }),
        ]);
      } catch (e) {
        this.logger.warn('Failed to seed canonical fleet during admin list:', e);
      }
    }

    const mediaIds = services.flatMap((s) => (s.heroMediaId ? [s.heroMediaId] : []));
    const media = mediaIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: mediaIds }, deletedAt: null },
          select: { id: true, secureUrl: true, url: true, altText: true },
        })
      : [];
    const mediaById = new Map(media.map((a) => [a.id, a]));

    const items = services.map((service) => this.resolveLocalizedService(service, locale, mediaById));

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOneAdmin(id: string) {
    const service = await this.prisma.transportationService.findUnique({
      where: { id },
      include: {
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!service) {
      throw new NotFoundException(`Transportation service with ID "${id}" was not found.`);
    }
    const media = service.heroMediaId
      ? await this.prisma.mediaAsset.findUnique({
          where: { id: service.heroMediaId },
          select: { id: true, secureUrl: true, url: true, altText: true },
        })
      : null;
    const mediaById = media ? new Map([[media.id, media]]) : new Map();
    return this.resolveLocalizedService(service, 'en', mediaById);
  }

  async createAdmin(dto: CreateTransportationServiceDto) {
    const primaryName = dto.name || dto.nameAr || dto.nameEn || 'New Vehicle Service';
    const nameJsonb = dto.nameJsonb || {
      ar: dto.nameAr || primaryName,
      en: dto.nameEn || primaryName,
      es: primaryName,
      pt: primaryName,
      it: primaryName,
    };

    const descriptionJsonb = dto.descriptionJsonb || {
      ar: dto.description || '',
      en: dto.description || '',
      es: dto.description || '',
      pt: dto.description || '',
      it: dto.description || '',
    };

    const featuresList = Array.isArray(dto.features) ? dto.features : Array.isArray(dto.featuresJsonb) ? dto.featuresJsonb : [];

    const combinedFeaturesJsonb = {
      features: featuresList,
      nameJsonb,
      descriptionJsonb,
      heroImageUrl: dto.heroImageUrl,
      isArchived: false,
    };

    const created = await this.prisma.transportationService.create({
      data: {
        name: primaryName,
        serviceType: dto.serviceType || 'AIRPORT',
        vehicleCategory: dto.vehicleCategory || 'bus',
        vehicleType: dto.vehicleType || 'VIP Tour Vehicle',
        capacity: dto.capacity !== undefined ? Number(dto.capacity) : 50,
        doors: dto.doors !== undefined ? Number(dto.doors) : 2,
        transmission: dto.transmission || 'AUTO',
        basePriceUsd: new Prisma.Decimal(dto.basePriceUsd || 150),
        heroImageUrl: dto.heroImageUrl || this.getFallbackVehicleImage(dto.vehicleCategory),
        heroMediaId: dto.heroMediaId || null,
        isPrivate: dto.isPrivate !== undefined ? Boolean(dto.isPrivate) : false,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        description: dto.description || descriptionJsonb.en || descriptionJsonb.ar || '',
        pickupInstructions: dto.pickupInstructions || null,
        dropoffInstructions: dto.dropoffInstructions || null,
        featuresJsonb: combinedFeaturesJsonb,
      },
    });

    return this.resolveLocalizedService(created, 'en');
  }

  async updateAdmin(id: string, dto: UpdateTransportationServiceDto) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Transportation service with ID "${id}" was not found.`);
    }

    const prevJsonb: Record<string, any> = (existing.featuresJsonb && typeof existing.featuresJsonb === 'object' && !Array.isArray(existing.featuresJsonb))
      ? (existing.featuresJsonb as Record<string, any>)
      : {};

    const nameJsonb: Record<string, any> = {
      ...(prevJsonb.nameJsonb || {}),
      ...(dto.nameJsonb || {}),
      ar: dto.nameAr || dto.name || (prevJsonb.nameJsonb as any)?.ar || existing.name,
      en: dto.nameEn || dto.name || (prevJsonb.nameJsonb as any)?.en || existing.name,
    };
    if (dto.nameAr) nameJsonb.ar = dto.nameAr;
    if (dto.nameEn) nameJsonb.en = dto.nameEn;

    const descriptionJsonb: Record<string, any> = {
      ...(prevJsonb.descriptionJsonb || {}),
      ...(dto.descriptionJsonb || {}),
      ar: dto.description || (prevJsonb.descriptionJsonb as any)?.ar || existing.description || '',
      en: dto.description || (prevJsonb.descriptionJsonb as any)?.en || existing.description || '',
    };

    const featuresList = dto.features !== undefined
      ? dto.features
      : Array.isArray(prevJsonb.features)
      ? prevJsonb.features
      : Array.isArray(existing.featuresJsonb)
      ? existing.featuresJsonb
      : [];

    const updatedFeaturesJsonb = {
      ...prevJsonb,
      features: featuresList,
      nameJsonb,
      descriptionJsonb,
      heroImageUrl: dto.heroImageUrl !== undefined ? dto.heroImageUrl : existing.heroImageUrl,
    };

    const updated = await this.prisma.transportationService.update({
      where: { id },
      data: {
        name: dto.name || dto.nameEn || dto.nameAr || existing.name,
        serviceType: dto.serviceType !== undefined ? dto.serviceType : existing.serviceType,
        vehicleCategory: dto.vehicleCategory !== undefined ? dto.vehicleCategory : existing.vehicleCategory,
        vehicleType: dto.vehicleType !== undefined ? dto.vehicleType : existing.vehicleType,
        capacity: dto.capacity !== undefined ? Number(dto.capacity) : existing.capacity,
        doors: dto.doors !== undefined ? Number(dto.doors) : existing.doors,
        transmission: dto.transmission !== undefined ? dto.transmission : existing.transmission,
        basePriceUsd: dto.basePriceUsd !== undefined ? new Prisma.Decimal(dto.basePriceUsd) : existing.basePriceUsd,
        heroImageUrl: dto.heroImageUrl !== undefined ? dto.heroImageUrl : existing.heroImageUrl,
        heroMediaId: dto.heroMediaId !== undefined ? dto.heroMediaId : existing.heroMediaId,
        isPrivate: dto.isPrivate !== undefined ? Boolean(dto.isPrivate) : existing.isPrivate,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        description: dto.description !== undefined ? dto.description : existing.description,
        pickupInstructions: dto.pickupInstructions !== undefined ? dto.pickupInstructions : existing.pickupInstructions,
        dropoffInstructions: dto.dropoffInstructions !== undefined ? dto.dropoffInstructions : existing.dropoffInstructions,
        featuresJsonb: updatedFeaturesJsonb,
      },
    });

    return this.resolveLocalizedService(updated, 'en');
  }

  async deleteAdmin(id: string) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
      include: { bookings: { take: 1 } },
    });
    if (!existing) {
      throw new NotFoundException(`Transportation service with ID "${id}" was not found.`);
    }

    if (existing.bookings.length > 0) {
      // If service has active historical bookings, softly deactivate and archive it
      await this.prisma.transportationService.update({
        where: { id },
        data: {
          isActive: false,
          featuresJsonb: {
            ...(typeof existing.featuresJsonb === 'object' ? (existing.featuresJsonb as object) : {}),
            isArchived: true,
            deletedAt: new Date().toISOString(),
          },
        },
      });
      return { success: true, message: 'Transportation service archived due to existing customer bookings.' };
    }

    await this.prisma.transportationService.delete({
      where: { id },
    });

    return { success: true, message: 'Transportation service deleted permanently.' };
  }

  async archiveAdmin(id: string) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Transportation service with ID "${id}" was not found.`);
    }

    const prevJsonb: Record<string, any> = (existing.featuresJsonb && typeof existing.featuresJsonb === 'object' && !Array.isArray(existing.featuresJsonb))
      ? (existing.featuresJsonb as Record<string, any>)
      : {};

    const updated = await this.prisma.transportationService.update({
      where: { id },
      data: {
        isActive: false,
        featuresJsonb: {
          ...prevJsonb,
          isArchived: true,
          archivedAt: new Date().toISOString(),
        },
      },
    });

    return this.resolveLocalizedService(updated, 'en');
  }

  async unarchiveAdmin(id: string) {
    const existing = await this.prisma.transportationService.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Transportation service with ID "${id}" was not found.`);
    }

    const prevJsonb: Record<string, any> = (existing.featuresJsonb && typeof existing.featuresJsonb === 'object' && !Array.isArray(existing.featuresJsonb))
      ? (existing.featuresJsonb as Record<string, any>)
      : {};

    const updated = await this.prisma.transportationService.update({
      where: { id },
      data: {
        isActive: true,
        featuresJsonb: {
          ...prevJsonb,
          isArchived: false,
          restoredAt: new Date().toISOString(),
        },
      },
    });

    return this.resolveLocalizedService(updated, 'en');
  }

  // ------------------------------------------------------
  // ADMIN BOOKINGS MANAGEMENT
  // ------------------------------------------------------
  async findAllBookingsAdmin(status?: string) {
    const where: Prisma.TransportationBookingWhereInput = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const bookings = await this.prisma.transportationBooking.findMany({
      where,
      include: {
        service: true,
        user: {
          select: { id: true, email: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b) => this.toSafeBooking(b));
  }

  async updateBookingStatusAdmin(id: string, dto: UpdateTransportationBookingStatusDto) {
    const existing = await this.prisma.transportationBooking.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Transportation booking with ID "${id}" was not found.`);
    }

    const updated = await this.prisma.transportationBooking.update({
      where: { id },
      data: {
        status: dto.status,
        driverName: dto.driverName !== undefined ? dto.driverName : existing.driverName,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: {
        service: true,
        user: {
          select: { id: true, email: true, name: true, phone: true },
        },
      },
    });

    return this.toSafeBooking(updated);
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

  async findUserBookings(userId: string) {
    const bookings = await this.prisma.transportationBooking.findMany({
      where: { userId },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => this.toSafeBooking(booking));
  }
}

