import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extractI18nFallback,
  sanitizePlainText,
} from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';
import { CreateHotelDto, HotelRoomDto, UpdateHotelDto } from './dto/hotel.dto';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeLocalized(
    value: Record<string, string>,
    maxLength: number,
    required = false,
  ): Prisma.InputJsonValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Localized hotel content must be an object');
    }

    const entries = Object.entries(value);
    if (
      entries.length === 0 ||
      entries.some(
        ([locale, text]) =>
          !SUPPORTED_LOCALES.includes(locale) ||
          typeof text !== 'string' ||
          text.length > maxLength,
      )
    ) {
      throw new BadRequestException('Invalid localized hotel content');
    }

    const sanitized = Object.fromEntries(
      entries.map(([locale, text]) => [
        locale,
        sanitizePlainText(text).slice(0, maxLength),
      ]),
    );
    if (required && !sanitized.en?.trim()) {
      throw new BadRequestException('English hotel content is required');
    }
    return sanitized as Prisma.InputJsonValue;
  }

  private sanitizeObject(value: Record<string, unknown>): Prisma.InputJsonValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Hotel metadata must be an object');
    }
    return value as Prisma.InputJsonValue;
  }

  private roomData(room: HotelRoomDto, currency: string) {
    return {
      slug: room.slug,
      nameJsonb: this.sanitizeLocalized(room.nameJsonb, 255, true),
      descriptionJsonb: room.descriptionJsonb
        ? this.sanitizeLocalized(room.descriptionJsonb, 5_000)
        : undefined,
      ratePerNight: room.ratePerNight,
      currency: room.currency ?? currency,
      mealPlanJsonb: room.mealPlanJsonb
        ? this.sanitizeLocalized(room.mealPlanJsonb, 100)
        : undefined,
      maxOccupancy: room.maxOccupancy,
      inventory: room.inventory ?? 0,
      isActive: room.isActive ?? false,
      sortOrder: room.sortOrder ?? 0,
    };
  }

  private hotelData(dto: CreateHotelDto | UpdateHotelDto): Prisma.HotelUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.nameJsonb !== undefined) data.nameJsonb = this.sanitizeLocalized(dto.nameJsonb, 255, true);
    if (dto.descriptionJsonb !== undefined) data.descriptionJsonb = this.sanitizeLocalized(dto.descriptionJsonb, 10_000);
    if (dto.destinationSlug !== undefined) data.destinationSlug = dto.destinationSlug;
    if (dto.city !== undefined) data.city = sanitizePlainText(dto.city).slice(0, 100);
    if (dto.stars !== undefined) data.stars = dto.stars;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.addressJsonb !== undefined) data.addressJsonb = this.sanitizeLocalized(dto.addressJsonb, 500);
    if (dto.phone !== undefined) data.phone = sanitizePlainText(dto.phone).slice(0, 50) || null;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.amenitiesJsonb !== undefined) data.amenitiesJsonb = this.sanitizeObject(dto.amenitiesJsonb);
    if (dto.policiesJsonb !== undefined) data.policiesJsonb = this.sanitizeObject(dto.policiesJsonb);
    if (dto.heroMediaId !== undefined) data.heroMediaId = dto.heroMediaId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return data as Prisma.HotelUncheckedCreateInput;
  }

  private async heroUrls(hotels: Array<{ heroMediaId: string | null }>) {
    const ids = hotels.flatMap((hotel) => (hotel.heroMediaId ? [hotel.heroMediaId] : []));
    if (ids.length === 0) return new Map<string, { url: string; altText: string | null }>();
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, secureUrl: true, url: true, altText: true },
    });
    return new Map(assets.map((asset) => [asset.id, { url: asset.secureUrl || asset.url, altText: asset.altText }]));
  }

  private roomView(room: { id: string; slug: string; nameJsonb: Prisma.JsonValue; descriptionJsonb: Prisma.JsonValue | null; ratePerNight: Prisma.Decimal; currency: string; mealPlanJsonb: Prisma.JsonValue | null; maxOccupancy: number; inventory: number; isActive: boolean }) {
    return {
      id: room.id,
      slug: room.slug,
      name: room.nameJsonb,
      description: room.descriptionJsonb,
      ratePerNight: Number(room.ratePerNight),
      currency: room.currency,
      mealPlan: room.mealPlanJsonb,
      maxOccupancy: room.maxOccupancy,
      inventory: room.inventory,
      isActive: room.isActive,
    };
  }

  private async publicView(hotels: Array<any>, locale: string) {
    const mediaById = await this.heroUrls(hotels);
    return hotels.map((hotel) => {
      const rooms = hotel.rooms.map((room: any) => ({
        ...this.roomView(room),
        name: extractI18nFallback(room.nameJsonb, locale),
        description: room.descriptionJsonb
          ? extractI18nFallback(room.descriptionJsonb, locale)
          : null,
        mealPlan: room.mealPlanJsonb
          ? extractI18nFallback(room.mealPlanJsonb, locale)
          : null,
      }));
      const rates = rooms.map((room: { ratePerNight: number }) => room.ratePerNight);
      const hero = hotel.heroMediaId ? mediaById.get(hotel.heroMediaId) : undefined;
      return {
        id: hotel.id,
        slug: hotel.slug,
        name: extractI18nFallback(hotel.nameJsonb, locale),
        description: hotel.descriptionJsonb
          ? extractI18nFallback(hotel.descriptionJsonb, locale)
          : null,
        destinationSlug: hotel.destinationSlug,
        city: hotel.city,
        stars: hotel.stars,
        rating: hotel.rating === null ? null : Number(hotel.rating),
        currency: hotel.currency,
        address: hotel.addressJsonb
          ? extractI18nFallback(hotel.addressJsonb, locale)
          : null,
        amenities: hotel.amenitiesJsonb,
        policies: hotel.policiesJsonb,
        heroMediaId: hotel.heroMediaId,
        heroImageUrl: hero?.url ?? null,
        heroImageAlt: hero?.altText ?? null,
        pricePerNight: rates.length ? Math.min(...rates) : null,
        rooms,
      };
    });
  }

  async findAllPublic(locale = 'en', destinationSlug?: string, limit = 24) {
    const hotels = await this.prisma.hotel.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        isActive: true,
        ...(destinationSlug ? { destinationSlug } : {}),
      },
      include: {
        rooms: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return this.publicView(hotels, locale);
  }

  async findOnePublic(slug: string, locale = 'en') {
    const hotel = await this.prisma.hotel.findFirst({
      where: { slug, deletedAt: null, status: 'PUBLISHED', isActive: true },
      include: {
        rooms: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!hotel) throw new NotFoundException(`Hotel '${slug}' not found`);
    return (await this.publicView([hotel], locale))[0];
  }

  async findAllAdmin(pageVal = 1, limitVal = 20, search?: string, status?: string, destinationSlug?: string) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(destinationSlug ? { destinationSlug } : {}),
      ...(search
        ? {
            OR: [
              { slug: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, hotels] = await Promise.all([
      this.prisma.hotel.count({ where }),
      this.prisma.hotel.findMany({
        where,
        include: { rooms: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    const mediaById = await this.heroUrls(hotels);
    const items = hotels.map((hotel) => ({
      ...hotel,
      rating: hotel.rating === null ? null : Number(hotel.rating),
      heroImageUrl: hotel.heroMediaId ? mediaById.get(hotel.heroMediaId)?.url ?? null : null,
      rooms: hotel.rooms.map((room) => this.roomView(room)),
    }));
    return paginate(items, total, page, limit);
  }

  async findOneAdmin(id: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      include: { rooms: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!hotel) throw new NotFoundException(`Hotel '${id}' not found`);
    const mediaById = await this.heroUrls([hotel]);
    return {
      ...hotel,
      rating: hotel.rating === null ? null : Number(hotel.rating),
      heroImageUrl: hotel.heroMediaId ? mediaById.get(hotel.heroMediaId)?.url ?? null : null,
      rooms: hotel.rooms.map((room) => this.roomView(room)),
    };
  }

  async createAdmin(dto: CreateHotelDto) {
    const data = this.hotelData(dto);
    return this.prisma.hotel.create({
      data: {
        ...data,
        rooms: dto.rooms?.length
          ? { create: dto.rooms.map((room) => this.roomData(room, dto.currency ?? 'USD')) }
          : undefined,
      },
      include: { rooms: true },
    });
  }

  async updateAdmin(id: string, dto: UpdateHotelDto) {
    await this.findOneAdmin(id);
    const data = this.hotelData(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.rooms !== undefined) {
        await tx.hotelRoom.updateMany({
          where: { hotelId: id, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
        });
      }
      return tx.hotel.update({
        where: { id },
        data: {
          ...data,
          ...(dto.rooms !== undefined
            ? { rooms: { create: dto.rooms.map((room) => this.roomData(room, dto.currency ?? 'USD')) } }
            : {}),
        },
        include: { rooms: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async softDeleteAdmin(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.$transaction([
      this.prisma.hotel.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, status: 'ARCHIVED' } }),
      this.prisma.hotelRoom.updateMany({ where: { hotelId: id, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } }),
    ]);
    return { success: true, message: `Hotel '${id}' deleted.` };
  }
}
