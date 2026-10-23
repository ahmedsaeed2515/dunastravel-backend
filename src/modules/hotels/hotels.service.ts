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
import {
  CreateHotelDto,
  CreateSeasonDto,
  HotelRoomDto,
  RoomSeasonPricingDto,
  UpdateHotelDto,
  UpdateSeasonDto,
  UpsertTripHotelDto,
} from './dto/hotel.dto';
import {
  CreateHotelBookingDto,
  UpdateHotelBookingStatusDto,
  AdminHotelBookingsQueryDto,
} from './dto/hotel-booking.dto';
import { AuthenticatedUser } from '../../common/types';

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
      throw new BadRequestException(
        'Localized hotel content must be an object',
      );
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
    return sanitized;
  }

  private sanitizeObject(
    value: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Hotel metadata must be an object');
    }
    return value as Prisma.InputJsonValue;
  }

  private mapRoomSeasonPricingInput(
    sp: RoomSeasonPricingDto,
    defaultCurrency: string,
  ) {
    return {
      seasonId: sp.seasonId,
      ratePerNight: new Prisma.Decimal(sp.ratePerNight),
      singleSupplement: new Prisma.Decimal(sp.singleSupplement ?? 0),
      childRate: new Prisma.Decimal(sp.childRate ?? 0),
      extraBedRate: new Prisma.Decimal(sp.extraBedRate ?? 0),
      currency: sp.currency ?? defaultCurrency,
      boardBasis: sp.boardBasis ?? 'BB',
      isActive: sp.isActive ?? true,
    };
  }

  private deduplicateSeasonPricings(
    seasonPricings?: RoomSeasonPricingDto[],
  ): RoomSeasonPricingDto[] {
    if (!Array.isArray(seasonPricings) || seasonPricings.length === 0)
      return [];
    const bySeasonId = new Map<string, RoomSeasonPricingDto>();
    for (const sp of seasonPricings) {
      if (!sp?.seasonId) continue;
      bySeasonId.set(sp.seasonId, sp);
    }
    return Array.from(bySeasonId.values());
  }

  private roomData(room: HotelRoomDto, currency: string) {
    const resolvedCurrency = room.currency ?? currency;
    const dedupedSeasonPricings = this.deduplicateSeasonPricings(
      room.seasonPricings,
    );
    return {
      slug: room.slug,
      nameJsonb: this.sanitizeLocalized(room.nameJsonb, 255, true),
      descriptionJsonb: room.descriptionJsonb
        ? typeof room.descriptionJsonb === 'object' &&
          !Array.isArray(room.descriptionJsonb)
          ? Object.keys(room.descriptionJsonb).some(
              (k) => !SUPPORTED_LOCALES.includes(k),
            )
            ? this.sanitizeObject(room.descriptionJsonb)
            : this.sanitizeLocalized(
                room.descriptionJsonb as Record<string, string>,
                5_000,
              )
          : undefined
        : undefined,
      ratePerNight: room.ratePerNight,
      currency: resolvedCurrency,
      mealPlanJsonb: room.mealPlanJsonb
        ? typeof room.mealPlanJsonb === 'object' &&
          !Array.isArray(room.mealPlanJsonb)
          ? Object.keys(room.mealPlanJsonb).some(
              (k) => !SUPPORTED_LOCALES.includes(k),
            )
            ? this.sanitizeObject(room.mealPlanJsonb)
            : this.sanitizeLocalized(room.mealPlanJsonb, 100)
          : undefined
        : undefined,
      maxOccupancy: room.maxOccupancy,
      inventory: room.inventory ?? 0,
      isActive: room.isActive ?? false,
      sortOrder: room.sortOrder ?? 0,
      ...(dedupedSeasonPricings.length > 0
        ? {
            seasonPricings: {
              create: dedupedSeasonPricings.map((sp) =>
                this.mapRoomSeasonPricingInput(sp, resolvedCurrency),
              ),
            },
          }
        : {}),
    };
  }

  private getFallbackHotelImage(
    destinationSlug?: string,
    city?: string,
    slug?: string,
  ): string {
    const key =
      `${slug || ''} ${city || ''} ${destinationSlug || ''}`.toLowerCase();
    if (
      key.includes('atlantis') ||
      key.includes('dubai') ||
      key.includes('royal')
    ) {
      return 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1200';
    }
    if (
      key.includes('istanbul') ||
      key.includes('ciragan') ||
      key.includes('turkey') ||
      key.includes('turquia')
    ) {
      return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200';
    }
    if (
      key.includes('petra') ||
      key.includes('movenpick') ||
      key.includes('jordan') ||
      key.includes('jordania')
    ) {
      return 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200';
    }
    if (
      key.includes('siwa') ||
      key.includes('desert') ||
      key.includes('oasis')
    ) {
      return 'https://images.unsplash.com/photo-1544971587-b842c27f8c14?q=80&w=1200';
    }
    if (
      key.includes('luxor') ||
      key.includes('aswan') ||
      key.includes('nile')
    ) {
      return 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?q=80&w=1200';
    }
    if (
      key.includes('marriott') ||
      key.includes('cairo') ||
      key.includes('mena') ||
      key.includes('pyramid') ||
      key.includes('egypt')
    ) {
      return 'https://images.unsplash.com/photo-1572252821143-035a0f6700c2?q=80&w=1200';
    }
    if (
      key.includes('morocco') ||
      key.includes('marruecos') ||
      key.includes('marrakech')
    ) {
      return 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200';
    }
    if (
      key.includes('greece') ||
      key.includes('santorini') ||
      key.includes('mykonos')
    ) {
      return 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200';
    }
    return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200';
  }

  private hotelData(
    dto: CreateHotelDto | UpdateHotelDto,
    existingAmenities?: Record<string, unknown> | null,
  ): Prisma.HotelUncheckedCreateInput {
    const data: Record<string, unknown> = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.nameJsonb !== undefined)
      data.nameJsonb = this.sanitizeLocalized(dto.nameJsonb, 255, true);
    if (dto.descriptionJsonb !== undefined)
      data.descriptionJsonb = this.sanitizeLocalized(
        dto.descriptionJsonb,
        10_000,
      );
    if (dto.destinationSlug !== undefined)
      data.destinationSlug = dto.destinationSlug;
    if (dto.city !== undefined)
      data.city = sanitizePlainText(dto.city).slice(0, 100);
    if (dto.stars !== undefined) data.stars = dto.stars;
    if (dto.rating !== undefined) data.rating = dto.rating;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.addressJsonb !== undefined)
      data.addressJsonb = this.sanitizeLocalized(dto.addressJsonb, 500);
    if (dto.phone !== undefined)
      data.phone = sanitizePlainText(dto.phone).slice(0, 50) || null;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.website !== undefined) data.website = dto.website;

    const baseAmenities =
      dto.amenitiesJsonb !== undefined
        ? dto.amenitiesJsonb && typeof dto.amenitiesJsonb === 'object'
          ? { ...dto.amenitiesJsonb }
          : {}
        : existingAmenities && typeof existingAmenities === 'object'
          ? { ...existingAmenities }
          : {};
    const amenities = { ...baseAmenities } as Record<string, unknown>;

    if (
      dto.amenitiesJsonb !== undefined &&
      existingAmenities &&
      typeof existingAmenities === 'object'
    ) {
      if (
        dto.heroImageUrl === undefined &&
        existingAmenities.heroImageUrl !== undefined &&
        amenities.heroImageUrl === undefined
      ) {
        amenities.heroImageUrl = existingAmenities.heroImageUrl;
      }
      if (
        dto.images === undefined &&
        existingAmenities.images !== undefined &&
        amenities.images === undefined
      ) {
        amenities.images = existingAmenities.images;
      }
    }

    if (dto.heroImageUrl !== undefined) {
      if (dto.heroImageUrl) {
        amenities.heroImageUrl = dto.heroImageUrl;
      } else {
        delete amenities.heroImageUrl;
      }
    }
    if (dto.images !== undefined && Array.isArray(dto.images)) {
      amenities.images = dto.images;
    }
    if (
      dto.amenitiesJsonb !== undefined ||
      dto.heroImageUrl !== undefined ||
      dto.images !== undefined
    ) {
      data.amenitiesJsonb = this.sanitizeObject(amenities);
    }

    if (dto.policiesJsonb !== undefined)
      data.policiesJsonb = this.sanitizeObject(dto.policiesJsonb);
    if (dto.heroMediaId !== undefined)
      data.heroMediaId = dto.heroMediaId || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    // Public visibility is defined by status === 'PUBLISHED' AND isActive === true.
    // The dashboard only exposes an Active/Archived toggle, so saving a hotel
    // explicitly as PUBLISHED (while leaving isActive untouched) must not silently
    // keep the record hidden from the public API. Archiving always wins.
    if (data.status === 'PUBLISHED' && data.isActive === undefined) {
      data.isActive = true;
    }
    if (data.status === 'ARCHIVED') {
      data.isActive = false;
    }
    if (dto.isGlobal !== undefined) {
      data.isGlobal = dto.isGlobal;
    } else if (!existingAmenities) {
      data.isGlobal = true;
    }
    if (dto.tourId !== undefined) data.tourId = dto.tourId || null;
    return data as Prisma.HotelUncheckedCreateInput;
  }

  /**
   * A hotel can only be publicly visible when it is PUBLISHED + active AND has at
   * least one active room holding real inventory. The dashboard uses a single
   * Active/Archived toggle, so saving a hotel while its rooms are still in draft
   * would otherwise leave visitors looking at a "published" page with no bookable
   * rooms. When the rules are not met we transparently demote the record to draft
   * so what the admin sees matches what the public API serves.
   */
  private async withRoomDerivedStatus<T extends Record<string, unknown>>(
    tx: any,
    data: T,
    hotelId: string,
    existingRooms: Array<any>,
    options?: {
      keptRoomIds?: Set<string>;
      pendingRooms?: Array<Record<string, unknown>>;
    },
  ): Promise<T> {
    if (data.status !== 'PUBLISHED') return data;
    if (!tx?.hotelRoom?.findFirst) return data;

    try {
      const activeRoom = await tx.hotelRoom.findFirst({
        where: {
          hotelId,
          deletedAt: null,
          isActive: true,
          inventory: { gt: 0 },
        },
        select: { id: true },
      });
      if (activeRoom) return data;

      // No bookable room in the database. Check whether the incoming payload adds
      // one (rooms are written separately inside the same transaction).
      const pendingRooms = options?.pendingRooms;
      if (Array.isArray(pendingRooms) && pendingRooms.length > 0) {
        const payloadHasBookableRoom = pendingRooms.some(
          (room: any) =>
            room?.isActive !== false && Number(room?.inventory) > 0,
        );
        return payloadHasBookableRoom
          ? data
          : { ...data, status: 'DRAFT', isActive: false };
      }

      // Kept rooms may still be updated later inside the transaction; if the update
      // payload marks any of them active with stock, publishing is legitimate.
      if (options?.keptRoomIds && options.keptRoomIds.size > 0) return data;

      const hasLiveRooms = existingRooms.some((room) => !room.deletedAt);
      if (hasLiveRooms) {
        // Rooms exist but none are bookable yet: keep the hotel as a draft.
        return { ...data, status: 'DRAFT', isActive: false };
      }

      // Hotel has never had rooms configured: allow publishing (rooms added later).
      return data;
    } catch {
      // Never block a save because of the consistency probe.
      return data;
    }
  }

  private async heroUrls(hotels: Array<any>) {
    const ids = hotels.flatMap((hotel) =>
      hotel.heroMediaId ? [hotel.heroMediaId] : [],
    );
    const hotelIds = hotels.map((h) => h.id).filter(Boolean);

    const [assetsById, assetsByHotel] = await Promise.all([
      ids.length > 0
        ? this.prisma.mediaAsset.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: { id: true, secureUrl: true, url: true, altText: true },
          })
        : [],
      hotelIds.length > 0
        ? this.prisma.mediaAsset.findMany({
            where: {
              entityType: 'HOTEL',
              entityId: { in: hotelIds },
              deletedAt: null,
            },
            select: {
              id: true,
              entityId: true,
              secureUrl: true,
              url: true,
              altText: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : [],
    ]);

    const mediaMap = new Map<string, { url: string; altText: string | null }>();
    for (const asset of assetsById) {
      mediaMap.set(asset.id, {
        url: asset.secureUrl || asset.url,
        altText: asset.altText,
      });
    }

    const galleryByHotelId = new Map<
      string,
      Array<{ id: string; url: string; altText: string | null }>
    >();
    for (const asset of assetsByHotel) {
      if (!asset.entityId) continue;
      const list = galleryByHotelId.get(asset.entityId) || [];
      list.push({
        id: asset.id,
        url: asset.secureUrl || asset.url,
        altText: asset.altText,
      });
      galleryByHotelId.set(asset.entityId, list);
    }

    return { mediaMap, galleryByHotelId };
  }

  /**
   * Resolve the hotel photo gallery.
   *
   * A gallery configured from the dashboard is persisted in
   * `amenitiesJsonb.images`. When that key exists it is authoritative — even when
   * it is an empty array, so that removing every photo actually clears the public
   * gallery. Hotels that never had a gallery configured keep falling back to the
   * media-library assets linked to them (legacy behaviour).
   */
  private resolveHotelGallery(
    hotel: { id: string; amenitiesJsonb?: unknown },
    galleryByHotelId: Map<
      string,
      Array<{ id: string; url: string; altText: string | null }>
    >,
  ): Array<{
    id?: string;
    url: string;
    altText?: string | null;
    sortOrder?: number;
  }> {
    const configured = (hotel.amenitiesJsonb as any)?.images;
    if (Array.isArray(configured)) {
      return configured
        .map((image: any) => {
          if (typeof image === 'string') {
            const url = image.trim();
            return url ? { url } : null;
          }
          if (
            image &&
            typeof image === 'object' &&
            typeof image.url === 'string' &&
            image.url.trim()
          ) {
            return { ...image, url: image.url.trim() };
          }
          return null;
        })
        .filter(
          (
            image,
          ): image is {
            id?: string;
            url: string;
            altText?: string | null;
            sortOrder?: number;
          } => Boolean(image),
        );
    }
    return galleryByHotelId.get(hotel.id) || [];
  }

  /** The hero is derived from the first gallery photo, which may be a string or an object. */
  private firstGalleryUrl(gallery: Array<unknown>): string | null {
    const first = gallery[0];
    if (!first) return null;
    if (typeof first === 'string') return first.trim() || null;
    const url = (first as { url?: unknown }).url;
    return typeof url === 'string' && url.trim() ? url.trim() : null;
  }

  private roomView(room: {
    id: string;
    slug: string;
    nameJsonb: Prisma.JsonValue;
    descriptionJsonb: Prisma.JsonValue | null;
    ratePerNight: Prisma.Decimal;
    currency: string;
    mealPlanJsonb: Prisma.JsonValue | null;
    maxOccupancy: number;
    inventory: number;
    isActive: boolean;
    seasonPricings?: Array<any>;
  }) {
    const desc = room.descriptionJsonb as Record<string, any> | null;
    const seasonPricings = Array.isArray(room.seasonPricings)
      ? room.seasonPricings.map((sp: any) => {
          const ratePerNight = Number(
            sp.ratePerNight ?? sp.ratePerNightUsd ?? 0,
          );
          const singleSupplement = Number(
            sp.singleSupplement ?? sp.singleSupplementUsd ?? 0,
          );
          const childRate = Number(sp.childRate ?? sp.childRateUsd ?? 0);
          const extraBedRate = Number(sp.extraBedRate ?? sp.extraBedUsd ?? 0);
          return {
            id: sp.id,
            seasonId: sp.seasonId,
            seasonCode: sp.season?.code ?? null,
            seasonNameJsonb: sp.season?.nameJsonb ?? null,
            startDate: sp.season?.startDate
              ? new Date(sp.season.startDate).toISOString().split('T')[0]
              : null,
            endDate: sp.season?.endDate
              ? new Date(sp.season.endDate).toISOString().split('T')[0]
              : null,
            ratePerNight,
            ratePerNightUsd: ratePerNight,
            singleSupplement,
            singleSupplementUsd: singleSupplement,
            childRate,
            childRateUsd: childRate,
            extraBedRate,
            extraBedUsd: extraBedRate,
            currency: sp.currency ?? room.currency,
            boardBasis: sp.boardBasis ?? 'BB',
            isActive: sp.isActive ?? true,
          };
        })
      : [];

    return {
      id: room.id,
      slug: room.slug,
      name: room.nameJsonb,
      description: desc?.overview || room.descriptionJsonb,
      ratePerNight: Number(room.ratePerNight),
      currency: room.currency,
      mealPlan: room.mealPlanJsonb,
      maxOccupancy: room.maxOccupancy,
      inventory: room.inventory,
      isActive: room.isActive,
      bedType: desc?.bedType || null,
      viewType: desc?.viewType || null,
      smokingAllowed: desc?.smokingAllowed ?? false,
      petsAllowed: desc?.petsAllowed ?? false,
      image: desc?.image || null,
      gallery: Array.isArray(desc?.gallery) ? desc.gallery : [],
      amenities: Array.isArray(desc?.amenities) ? desc.amenities : [],
      seasonPricings,
    };
  }

  private async publicView(hotels: Array<any>, locale: string) {
    const { mediaMap, galleryByHotelId } = await this.heroUrls(hotels);
    return hotels.map((hotel) => {
      const rooms = (hotel.rooms || []).map((room: any) => {
        const view = this.roomView(room);
        const desc = room.descriptionJsonb as Record<string, any> | null;
        return {
          ...view,
          name: extractI18nFallback(room.nameJsonb, locale),
          description: desc?.overview
            ? extractI18nFallback(desc.overview, locale)
            : room.descriptionJsonb
              ? extractI18nFallback(room.descriptionJsonb, locale)
              : null,
          bedType: desc?.bedType
            ? extractI18nFallback(desc.bedType, locale)
            : null,
          viewType: desc?.viewType
            ? extractI18nFallback(desc.viewType, locale)
            : null,
          mealPlan: room.mealPlanJsonb
            ? extractI18nFallback(room.mealPlanJsonb, locale)
            : null,
          seasonPricings: view.seasonPricings.map((sp) => ({
            ...sp,
            seasonName: sp.seasonNameJsonb
              ? extractI18nFallback(sp.seasonNameJsonb, locale)
              : sp.seasonCode,
          })),
        };
      });
      const rates = rooms.map(
        (room: { ratePerNight: number }) => room.ratePerNight,
      );
      const hero = hotel.heroMediaId
        ? mediaMap.get(hotel.heroMediaId)
        : undefined;
      const directHeroUrl = hotel.amenitiesJsonb?.heroImageUrl || null;
      const hotelGallery = this.resolveHotelGallery(hotel, galleryByHotelId);
      const resolvedHeroUrl =
        hero?.url ||
        directHeroUrl ||
        this.firstGalleryUrl(hotelGallery) ||
        this.getFallbackHotelImage(
          hotel.destinationSlug,
          hotel.city,
          hotel.slug,
        );

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
        phone: hotel.phone || null,
        email: hotel.email || null,
        website: hotel.website || null,
        amenities: hotel.amenitiesJsonb,
        policies: hotel.policiesJsonb,
        heroMediaId: hotel.heroMediaId,
        heroImageUrl: resolvedHeroUrl,
        heroImageAlt: hero?.altText ?? null,
        images: hotelGallery,
        pricePerNight: rates.length ? Math.min(...rates) : null,
        rooms,
      };
    });
  }

  async findAllPublic(locale = 'en', destinationSlug?: string, limit = 24) {
    const hotels = await this.prisma.hotel.findMany({
      where: {
        isGlobal: true,
        deletedAt: null,
        status: 'PUBLISHED',
        isActive: true,
        ...(destinationSlug ? { destinationSlug } : {}),
      },
      include: {
        rooms: {
          where: { deletedAt: null, isActive: true },
          include: {
            seasonPricings: {
              where: { isActive: true },
              include: { season: true },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return this.publicView(hotels, locale);
  }

  async findOnePublic(slug: string, locale = 'en') {
    const trimmed = slug?.trim();
    if (!trimmed) throw new NotFoundException(`Hotel not found`);
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        isGlobal: true,
        OR: [{ slug: trimmed }, { id: trimmed }],
        deletedAt: null,
        status: 'PUBLISHED',
        isActive: true,
      },
      include: {
        rooms: {
          where: { deletedAt: null, isActive: true },
          include: {
            seasonPricings: {
              where: { isActive: true },
              include: { season: true },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!hotel) throw new NotFoundException(`Hotel '${slug}' not found`);
    return (await this.publicView([hotel], locale))[0];
  }

  async findAllAdmin(
    pageVal = 1,
    limitVal = 20,
    search?: string,
    status?: string,
    destinationSlug?: string,
  ) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.HotelWhereInput = {
      isGlobal: true,
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
        include: {
          rooms: {
            where: { deletedAt: null },
            include: {
              seasonPricings: {
                include: { season: true },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          tripAccommodations: {
            select: {
              id: true,
              tourId: true,
              destination: true,
              nights: true,
              tour: { select: { id: true, slug: true, titleJsonb: true } },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    const { mediaMap, galleryByHotelId } = await this.heroUrls(hotels);
    const items = hotels.map((hotel) => {
      const hero = hotel.heroMediaId
        ? mediaMap.get(hotel.heroMediaId)
        : undefined;
      const directHeroUrl = (hotel.amenitiesJsonb as any)?.heroImageUrl || null;
      const hotelGallery = this.resolveHotelGallery(hotel, galleryByHotelId);
      const resolvedHeroUrl =
        hero?.url ||
        directHeroUrl ||
        this.firstGalleryUrl(hotelGallery) ||
        this.getFallbackHotelImage(
          hotel.destinationSlug,
          hotel.city,
          hotel.slug,
        );

      return {
        ...hotel,
        rating: hotel.rating === null ? null : Number(hotel.rating),
        heroImageUrl: resolvedHeroUrl,
        heroImageAlt: hero?.altText ?? null,
        images: hotelGallery,
        rooms: (hotel.rooms || []).map((room) => this.roomView(room)),
      };
    });
    return paginate(items, total, page, limit);
  }

  async findOneAdmin(id: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            seasonPricings: {
              include: { season: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!hotel) throw new NotFoundException(`Hotel '${id}' not found`);
    const { mediaMap, galleryByHotelId } = await this.heroUrls([hotel]);
    const hero = hotel.heroMediaId
      ? mediaMap.get(hotel.heroMediaId)
      : undefined;
    const directHeroUrl = (hotel.amenitiesJsonb as any)?.heroImageUrl || null;
    const hotelGallery = this.resolveHotelGallery(hotel, galleryByHotelId);
    const resolvedHeroUrl =
      hero?.url ||
      directHeroUrl ||
      this.firstGalleryUrl(hotelGallery) ||
      this.getFallbackHotelImage(hotel.destinationSlug, hotel.city, hotel.slug);

    return {
      ...hotel,
      rating: hotel.rating === null ? null : Number(hotel.rating),
      heroImageUrl: resolvedHeroUrl,
      heroImageAlt: hero?.altText ?? null,
      images: hotelGallery,
      rooms: (hotel.rooms || []).map((room) => this.roomView(room)),
    };
  }

  async createAdmin(dto: CreateHotelDto) {
    const data = this.hotelData(dto);
    return this.prisma.hotel.create({
      data: {
        ...data,
        rooms: dto.rooms?.length
          ? {
              create: dto.rooms.map((room) =>
                this.roomData(room, dto.currency ?? 'USD'),
              ),
            }
          : undefined,
      },
      include: {
        rooms: {
          include: {
            seasonPricings: { include: { season: true } },
          },
        },
      },
    });
  }

  async updateAdmin(id: string, dto: UpdateHotelDto) {
    const existingHotel = await this.findOneAdmin(id);
    const data = this.hotelData(
      dto,
      (existingHotel.amenitiesJsonb as Record<string, unknown> | null) ?? null,
    );
    const defaultCurrency = dto.currency ?? existingHotel.currency ?? 'USD';

    return this.prisma.$transaction(async (tx) => {
      if (dto.rooms !== undefined) {
        if (typeof tx.hotelRoom?.findMany === 'function') {
          const existingRooms = await tx.hotelRoom.findMany({
            where: { hotelId: id },
          });
          const keptRoomIds = new Set<string>();

          for (const roomDto of dto.rooms) {
            const matched = existingRooms.find(
              (r) =>
                (roomDto.id && r.id === roomDto.id) || r.slug === roomDto.slug,
            );
            const { seasonPricings: _sp, ...coreRoomData } = this.roomData(
              roomDto,
              defaultCurrency,
            );

            if (matched) {
              keptRoomIds.add(matched.id);
              await tx.hotelRoom.update({
                where: { id: matched.id },
                data: {
                  ...coreRoomData,
                  deletedAt: null,
                },
              });

              if (
                roomDto.seasonPricings !== undefined &&
                typeof tx.roomSeasonPricing?.deleteMany === 'function'
              ) {
                await tx.roomSeasonPricing.deleteMany({
                  where: { roomId: matched.id },
                });
                const dedupedSeasonPricings = this.deduplicateSeasonPricings(
                  roomDto.seasonPricings,
                );
                if (dedupedSeasonPricings.length > 0) {
                  await tx.roomSeasonPricing.createMany({
                    data: dedupedSeasonPricings.map((sp) => ({
                      roomId: matched.id,
                      ...this.mapRoomSeasonPricingInput(
                        sp,
                        roomDto.currency ?? defaultCurrency,
                      ),
                    })),
                  });
                }
              }
            } else {
              const created = await tx.hotelRoom.create({
                data: {
                  hotelId: id,
                  ...this.roomData(roomDto, defaultCurrency),
                },
              });
              keptRoomIds.add(created.id);
            }
          }

          const toSoftDeleteIds = existingRooms
            .filter((r) => !r.deletedAt && !keptRoomIds.has(r.id))
            .map((r) => r.id);

          if (toSoftDeleteIds.length > 0) {
            await tx.hotelRoom.updateMany({
              where: { id: { in: toSoftDeleteIds } },
              data: { deletedAt: new Date(), isActive: false },
            });
          }

          const resolvedData = await this.withRoomDerivedStatus(
            tx,
            data,
            id,
            existingHotel.rooms || [],
            {
              keptRoomIds,
              pendingRooms: dto.rooms as unknown as Array<
                Record<string, unknown>
              >,
            },
          );

          return tx.hotel.update({
            where: { id },
            data: resolvedData,
            include: {
              rooms: {
                where: { deletedAt: null },
                include: { seasonPricings: { include: { season: true } } },
                orderBy: { sortOrder: 'asc' },
              },
            },
          });
        }

        await tx.hotelRoom.deleteMany({
          where: { hotelId: id },
        });
      }

      const resolvedData = await this.withRoomDerivedStatus(
        tx,
        data,
        id,
        existingHotel.rooms || [],
        {
          pendingRooms: dto.rooms as unknown as Array<Record<string, unknown>>,
        },
      );

      return tx.hotel.update({
        where: { id },
        data: {
          ...resolvedData,
          ...(dto.rooms !== undefined
            ? {
                rooms: {
                  create: dto.rooms.map((room) =>
                    this.roomData(room, defaultCurrency),
                  ),
                },
              }
            : {}),
        },
        include: {
          rooms: {
            where: { deletedAt: null },
            include: { seasonPricings: { include: { season: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    });
  }

  // ----------------------------------------------------
  // Season Management (Public & Admin)
  // ----------------------------------------------------
  private validateSeasonDates(startDateStr: string, endDateStr: string) {
    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T00:00:00.000Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      throw new BadRequestException(
        'Season startDate must be on or before endDate',
      );
    }
    return { start, end };
  }

  async findAllSeasonsPublic(locale = 'en') {
    const seasons = await this.prisma.season.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
    });
    return seasons.map((s) => ({
      id: s.id,
      code: s.code,
      name: extractI18nFallback(s.nameJsonb, locale),
      nameJsonb: s.nameJsonb,
      startDate: s.startDate.toISOString().split('T')[0],
      endDate: s.endDate.toISOString().split('T')[0],
      multiplier: Number(s.multiplier),
      isActive: s.isActive,
      sortOrder: s.sortOrder,
    }));
  }

  async findAllSeasonsAdmin() {
    const seasons = await this.prisma.season.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
      include: {
        _count: { select: { roomPricings: true } },
      },
    });
    return seasons.map((s) => ({
      id: s.id,
      code: s.code,
      nameJsonb: s.nameJsonb,
      startDate: s.startDate.toISOString().split('T')[0],
      endDate: s.endDate.toISOString().split('T')[0],
      multiplier: Number(s.multiplier),
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      roomPricingsCount: s._count?.roomPricings ?? 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async createSeasonAdmin(dto: CreateSeasonDto) {
    const { start, end } = this.validateSeasonDates(dto.startDate, dto.endDate);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.season.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException(
        `Season with code '${code}' already exists`,
      );
    }
    return this.prisma.season.create({
      data: {
        code,
        nameJsonb: this.sanitizeLocalized(dto.nameJsonb, 255, true),
        startDate: start,
        endDate: end,
        multiplier: new Prisma.Decimal(dto.multiplier ?? 1.0),
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSeasonAdmin(id: string, dto: UpdateSeasonDto) {
    const existing = await this.prisma.season.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Season '${id}' not found`);

    const startStr =
      dto.startDate ?? existing.startDate.toISOString().split('T')[0];
    const endStr = dto.endDate ?? existing.endDate.toISOString().split('T')[0];
    const { start, end } = this.validateSeasonDates(startStr, endStr);

    const data: Prisma.SeasonUpdateInput = {
      startDate: start,
      endDate: end,
    };
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.nameJsonb !== undefined) {
      data.nameJsonb = this.sanitizeLocalized(dto.nameJsonb, 255, true);
    }
    if (dto.multiplier !== undefined) {
      data.multiplier = new Prisma.Decimal(dto.multiplier);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.season.update({
      where: { id },
      data,
    });
  }

  async deleteSeasonAdmin(id: string) {
    const existing = await this.prisma.season.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Season '${id}' not found`);
    await this.prisma.season.delete({ where: { id } });
    return { success: true, id };
  }

  async softDeleteAdmin(id: string) {
    await this.findOneAdmin(id);
    await this.prisma.$transaction([
      this.prisma.hotel.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, status: 'ARCHIVED' },
      }),
      this.prisma.hotelRoom.updateMany({
        where: { hotelId: id, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ]);
    return { success: true, message: `Hotel '${id}' deleted.` };
  }

  async publishAdmin(id: string) {
    const hotel = await this.findOneAdmin(id);
    const publishableRoom = hotel.rooms.some(
      (room) => room.isActive && room.inventory > 0 && room.ratePerNight >= 0,
    );
    const hasAnyRoom = hotel.rooms.length > 0;
    if (!publishableRoom && hasAnyRoom) {
      throw new BadRequestException(
        'A published hotel requires at least one active room with inventory',
      );
    }
    return this.prisma.hotel.update({
      where: { id },
      data: { status: 'PUBLISHED', isActive: true },
    });
  }

  async unpublishAdmin(id: string) {
    await this.findOneAdmin(id);
    // Demote to draft without touching room state, so the admin can later re-enable
    // "Active & Bookable" from the hotel editor and get published again.
    return this.prisma.hotel.update({
      where: { id },
      data: { status: 'DRAFT', isActive: false },
    });
  }

  async archiveAdmin(id: string) {
    await this.findOneAdmin(id);
    return this.prisma.hotel.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false },
    });
  }

  async unarchiveAdmin(id: string) {
    await this.findOneAdmin(id);
    // Unarchiving restores the hotel to the public catalog (mirrors the dashboard
    // "restored and active" toast), while keeping the hotel record consistent with
    // the publish rules.
    return this.prisma.hotel.update({
      where: { id },
      data: { status: 'PUBLISHED', isActive: true },
    });
  }

  async restoreAdmin(id: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id } });
    if (!hotel) throw new NotFoundException(`Hotel '${id}' not found`);
    if (!hotel.deletedAt) {
      throw new BadRequestException(`Hotel '${id}' is not deleted`);
    }
    return this.prisma.hotel.update({
      where: { id },
      data: { deletedAt: null, status: 'PUBLISHED', isActive: true },
    });
  }

  // ----------------------------------------------------
  // Trip-Specific Hotel Dedicated API
  // ----------------------------------------------------
  async getTripHotel(tourSlugOrId: string) {
    const trimmed = tourSlugOrId?.trim();
    if (!trimmed) throw new NotFoundException('Tour slug or ID is required');

    const tour = await this.prisma.tour.findFirst({
      where: {
        OR: [{ slug: trimmed }, { id: trimmed }],
        deletedAt: null,
      },
      select: { id: true, slug: true },
    });
    if (!tour) throw new NotFoundException(`Tour '${trimmed}' not found`);

    const hotel = await this.prisma.hotel.findFirst({
      where: { tourId: tour.id, deletedAt: null },
      include: {
        rooms: {
          where: { deletedAt: null },
          include: {
            seasonPricings: {
              include: { season: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!hotel) return null;

    const { mediaMap, galleryByHotelId } = await this.heroUrls([hotel]);
    const hero = hotel.heroMediaId
      ? mediaMap.get(hotel.heroMediaId)
      : undefined;
    const directHeroUrl = (hotel.amenitiesJsonb as any)?.heroImageUrl || null;
    const hotelGallery = this.resolveHotelGallery(hotel, galleryByHotelId);
    const resolvedHeroUrl =
      hero?.url ||
      directHeroUrl ||
      this.firstGalleryUrl(hotelGallery) ||
      this.getFallbackHotelImage(hotel.destinationSlug, hotel.city, hotel.slug);

    return {
      ...hotel,
      rating: hotel.rating === null ? null : Number(hotel.rating),
      heroImageUrl: resolvedHeroUrl,
      heroImageAlt: hero?.altText ?? null,
      images: hotelGallery,
      rooms: (hotel.rooms || []).map((room) => this.roomView(room)),
    };
  }

  async upsertTripHotel(
    tourSlugOrId: string,
    dto: UpsertTripHotelDto | CreateHotelDto,
  ) {
    const trimmed = tourSlugOrId?.trim();
    if (!trimmed) throw new NotFoundException('Tour slug or ID is required');

    const tour = await this.prisma.tour.findFirst({
      where: {
        OR: [{ slug: trimmed }, { id: trimmed }],
        deletedAt: null,
      },
      select: { id: true, slug: true, city: true, country: true },
    });
    if (!tour) throw new NotFoundException(`Tour '${trimmed}' not found`);

    const existingHotel = await this.prisma.hotel.findFirst({
      where: { tourId: tour.id, deletedAt: null },
    });

    const fallbackSlug =
      `trip-${tour.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-hotel`.slice(
        0,
        95,
      );
    const resolvedSlug =
      dto.slug && dto.slug.trim()
        ? (dto.slug.startsWith('trip-')
            ? dto.slug.trim()
            : `trip-${dto.slug.trim()}`
          ).slice(0, 95)
        : fallbackSlug;

    if (existingHotel) {
      const updateData: UpdateHotelDto = {
        ...dto,
        slug: existingHotel.slug || resolvedSlug,
        destinationSlug:
          dto.destinationSlug ||
          existingHotel.destinationSlug ||
          tour.city?.toLowerCase() ||
          'egypt',
        city: dto.city || existingHotel.city || tour.city || 'Cairo',
        stars: dto.stars ?? existingHotel.stars ?? 5,
        isGlobal: false,
        tourId: tour.id,
      };
      return this.updateAdmin(existingHotel.id, updateData);
    } else {
      const createData: CreateHotelDto = {
        ...dto,
        nameJsonb: dto.nameJsonb || { en: 'Trip Hotel', ar: 'فندق الرحلة' },
        slug: resolvedSlug,
        destinationSlug:
          dto.destinationSlug || tour.city?.toLowerCase() || 'egypt',
        city: dto.city || tour.city || 'Cairo',
        stars: dto.stars ?? 5,
        isGlobal: false,
        tourId: tour.id,
        status: dto.status || 'PUBLISHED',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      };
      return this.createAdmin(createData);
    }
  }

  async deleteTripHotel(tourSlugOrId: string) {
    const trimmed = tourSlugOrId?.trim();
    if (!trimmed) throw new NotFoundException('Tour slug or ID is required');

    const tour = await this.prisma.tour.findFirst({
      where: {
        OR: [{ slug: trimmed }, { id: trimmed }],
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!tour) throw new NotFoundException(`Tour '${trimmed}' not found`);

    const existingHotel = await this.prisma.hotel.findFirst({
      where: { tourId: tour.id, deletedAt: null },
    });
    if (!existingHotel) {
      return { success: true, message: 'No trip hotel associated' };
    }
    return this.softDeleteAdmin(existingHotel.id);
  }

  // ----------------------------------------------------
  // Standalone Hotel Bookings Engine
  // ----------------------------------------------------
  async createBookingPublic(dto: CreateHotelBookingDto) {
    let hotel = null;
    const targetHotel = dto.hotelId || dto.hotelSlug;
    if (targetHotel) {
      hotel = await this.prisma.hotel.findFirst({
        where: {
          OR: [{ id: targetHotel }, { slug: targetHotel }],
          deletedAt: null,
          status: 'PUBLISHED',
          isActive: true,
        },
        include: {
          rooms: {
            where: { deletedAt: null, isActive: true },
            include: {
              seasonPricings: {
                where: { isActive: true },
                include: { season: true },
              },
            },
          },
        },
      });
    }

    if (!hotel) {
      throw new NotFoundException(
        'Selected hotel not found or currently unavailable',
      );
    }

    // Match Room
    let room: any = null;
    const targetRoom = dto.roomId || dto.roomSlug;
    if (targetRoom) {
      room =
        hotel.rooms.find((r) => r.id === targetRoom || r.slug === targetRoom) ||
        null;
      if (!room) {
        throw new NotFoundException(
          'Selected room not found or currently unavailable',
        );
      }
    }

    // Parse Dates
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new BadRequestException(
        'Valid check-in and check-out dates are required',
      );
    }

    const diffTime = checkOut.getTime() - checkIn.getTime();
    const nights = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (nights <= 0) {
      throw new BadRequestException(
        'Check-out date must be after check-in date (minimum 1 night)',
      );
    }

    const roomsCount = Math.max(1, dto.roomsCount || 1);
    const guestsCount = Math.max(1, dto.guestsCount || 1);

    if (
      room &&
      room.maxOccupancy &&
      guestsCount > Number(room.maxOccupancy) * roomsCount
    ) {
      throw new BadRequestException(
        `Guests count (${guestsCount}) exceeds maximum capacity (${Number(room.maxOccupancy) * roomsCount}) for ${roomsCount} room(s)`,
      );
    }

    // Nationality is mandatory to submit a room booking request.
    const guestNationality = (dto.guestNationality || '').trim();
    if (!guestNationality) {
      throw new BadRequestException(
        'NATIONALITY_REQUIRED: Guest nationality is required to submit a booking request',
      );
    }

    // Calculate Rate (with Seasonal Pricing Resolution & Single Supplement)
    let roomRate =
      room && Number(room.ratePerNight) > 0 ? Number(room.ratePerNight) : 120;
    let singleSupplementPerNight = 0;
    if (
      room &&
      Array.isArray(room.seasonPricings) &&
      room.seasonPricings.length > 0
    ) {
      const checkInTime = checkIn.getTime();
      const matchedSeasonal = room.seasonPricings.find((sp: any) => {
        if (!sp.isActive || !sp.season?.isActive) return false;
        const sStart = new Date(sp.season.startDate).getTime();
        const sEnd = new Date(sp.season.endDate).getTime();
        return checkInTime >= sStart && checkInTime <= sEnd;
      });
      if (matchedSeasonal && Number(matchedSeasonal.ratePerNight) > 0) {
        roomRate = Number(matchedSeasonal.ratePerNight);
      }
      if (
        matchedSeasonal &&
        guestsCount === 1 &&
        roomsCount === 1 &&
        Number(matchedSeasonal.singleSupplement) > 0
      ) {
        singleSupplementPerNight = Number(matchedSeasonal.singleSupplement);
      }
    }
    const totalAmount = Number(
      (nights * roomsCount * (roomRate + singleSupplementPerNight)).toFixed(2),
    );

    // Unique Reference Code
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const referenceCode = `HTL-${Date.now().toString(36).toUpperCase().slice(-4)}-${randomSuffix}`;

    const booking = await this.prisma.hotelBooking.create({
      data: {
        referenceCode,
        hotelId: hotel.id,
        roomId: room ? room.id : null,
        guestName: sanitizePlainText(dto.guestName),
        guestEmail: dto.guestEmail.trim().toLowerCase(),
        guestPhone: sanitizePlainText(dto.guestPhone),
        guestNationality: sanitizePlainText(guestNationality),
        checkInDate: checkIn,
        checkOutDate: checkOut,
        nights,
        roomsCount,
        guestsCount,
        ratePerNightUsd: new Prisma.Decimal(roomRate),
        totalAmountUsd: new Prisma.Decimal(totalAmount),
        currency: 'USD',
        specialRequests: dto.specialRequests
          ? sanitizePlainText(dto.specialRequests)
          : null,
        status: 'PENDING',
      },
      include: {
        hotel: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            city: true,
            stars: true,
          },
        },
        room: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            ratePerNight: true,
          },
        },
      },
    });

    return {
      success: true,
      booking,
      referenceCode: booking.referenceCode,
      summary: {
        hotelName:
          (hotel.nameJsonb as any)?.en ||
          (hotel.nameJsonb as any)?.ar ||
          hotel.slug,
        roomName: room
          ? room.nameJsonb?.en || room.nameJsonb?.ar || room.slug
          : 'Standard Room',
        checkInDate: dto.checkInDate,
        checkOutDate: dto.checkOutDate,
        nights,
        roomsCount,
        guestsCount,
        guestNationality,
        ratePerNight: roomRate,
        totalAmountUsd: totalAmount,
        currency: 'USD',
      },
    };
  }

  async getBookingByReferencePublic(referenceCode: string) {
    const booking = await this.prisma.hotelBooking.findUnique({
      where: { referenceCode: referenceCode.trim().toUpperCase() },
      include: {
        hotel: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            city: true,
            stars: true,
            phone: true,
            email: true,
          },
        },
        room: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            ratePerNight: true,
          },
        },
      },
    });

    if (!booking || booking.deletedAt) {
      throw new NotFoundException(
        `Booking with reference '${referenceCode}' not found`,
      );
    }

    return booking;
  }

  async findAllBookingsAdmin(query: AdminHotelBookingsQueryDto) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const where: Prisma.HotelBookingWhereInput = {
      deletedAt: null,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    if (query.hotelId && query.hotelId !== 'ALL') {
      where.hotelId = query.hotelId;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { referenceCode: { contains: q, mode: 'insensitive' } },
        { guestName: { contains: q, mode: 'insensitive' } },
        { guestEmail: { contains: q, mode: 'insensitive' } },
        { guestPhone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.hotelBooking.count({ where }),
      this.prisma.hotelBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: {
              id: true,
              slug: true,
              nameJsonb: true,
              city: true,
              stars: true,
            },
          },
          room: {
            select: {
              id: true,
              slug: true,
              nameJsonb: true,
              ratePerNight: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records,
      meta: paginate(records, total, page, limit).meta,
    };
  }

  async updateBookingStatusAdmin(
    id: string,
    dto: UpdateHotelBookingStatusDto,
    actor: AuthenticatedUser,
  ) {
    const booking = await this.prisma.hotelBooking.findUnique({
      where: { id },
    });

    if (!booking || booking.deletedAt) {
      throw new NotFoundException(`Hotel booking '${id}' not found`);
    }

    const updated = await this.prisma.hotelBooking.update({
      where: { id },
      data: {
        status: dto.status,
        adminNotes:
          dto.adminNotes !== undefined ? dto.adminNotes : booking.adminNotes,
      },
      include: {
        hotel: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            city: true,
            stars: true,
          },
        },
        room: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            ratePerNight: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'HOTEL_BOOKING_STATUS_UPDATED',
        entityType: 'HOTEL_BOOKING',
        entityId: id,
        metadata: {
          referenceCode: booking.referenceCode,
          oldStatus: booking.status,
          newStatus: dto.status,
          adminNotes: dto.adminNotes,
        },
      },
    });

    return updated;
  }
}
