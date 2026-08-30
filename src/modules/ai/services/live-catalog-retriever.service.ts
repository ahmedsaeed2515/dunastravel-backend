import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GroundedTourEntity {
  id: string;
  slug: string;
  title: string;
  country: string;
  city: string;
  category: string;
  durationDays: number;
  basePriceUsd: number;
  currency: string;
  isFeatured: boolean;
  heroImage: string;
  publicUrl: string;
  highlights: string[];
  upcomingAvailabilities?: Array<{
    startDate: string;
    availableSeats: number;
    priceOverrideUsd?: number;
  }>;
}

export interface GroundedHotelEntity {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  starRating: number;
  description: string;
  amenities: string[];
  minPriceUsd: number;
  publicUrl: string;
}

export interface GroundedTransportEntity {
  id: string;
  name: string;
  vehicleType: string;
  capacity: number;
  priceUsd: number;
  origin: string;
  destination: string;
  isAvailable: boolean;
}

@Injectable()
export class LiveCatalogRetrieverService {
  private readonly logger = new Logger(LiveCatalogRetrieverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve localized title and highlights from tour Jsonb fields
   */
  private resolveLocalizedText(jsonbField: any, locale: string, fallback: string = ''): string {
    if (!jsonbField) return fallback;
    if (typeof jsonbField === 'string') return jsonbField;
    if (typeof jsonbField === 'object') {
      const loc = locale.toLowerCase().split('-')[0];
      return jsonbField[loc] || jsonbField.en || jsonbField.ar || fallback;
    }
    return fallback;
  }

  /**
   * Live Query: Fetch active published tours matching semantic candidate IDs or keyword filters
   */
  async getLiveToursByIds(tourIds: string[], locale: string = 'en'): Promise<GroundedTourEntity[]> {
    if (!tourIds || tourIds.length === 0) return [];

    const tours = await (this.prisma as any).tour.findMany({
      where: {
        OR: [
          { id: { in: tourIds } },
          { slug: { in: tourIds } },
        ],
        isActive: true,
        deletedAt: null,
      },
      include: {
        images: { where: { isHero: true }, take: 1 },
        availabilities: {
          where: {
            startDate: { gte: new Date() },
            isAvailable: true,
          },
          take: 3,
          orderBy: { startDate: 'asc' },
        },
      },
    });

    return tours.map((tour: any) => {
      const title = this.resolveLocalizedText(tour.titleJsonb, locale, tour.slug);
      const highlightsRaw = tour.highlightsJsonb;
      let highlights: string[] = [];
      if (Array.isArray(highlightsRaw)) {
        highlights = highlightsRaw.map((h: any) => typeof h === 'string' ? h : (h[locale] || h.en || ''));
      }

      const heroImage = tour.images?.[0]?.imageUrl || '/imgs/tours/classic.webp';
      const durationVal = tour.durationJsonb?.days || tour.durationDays || 8;

      return {
        id: tour.id,
        slug: tour.slug,
        title,
        country: tour.country || 'Egypt',
        city: tour.city || 'Cairo, Luxor, Aswan',
        category: tour.category || 'Luxury Tours',
        durationDays: Number(durationVal),
        basePriceUsd: Number(tour.basePriceUsd) || 1890,
        currency: tour.currency || 'USD',
        isFeatured: Boolean(tour.isFeatured),
        heroImage,
        publicUrl: `/tours/${tour.slug}`,
        highlights: highlights.slice(0, 4),
        upcomingAvailabilities: (tour.availabilities || []).map((a: any) => ({
          startDate: a.startDate.toISOString().split('T')[0],
          availableSeats: a.capacity - a.bookedCount,
          priceOverrideUsd: a.priceOverrideUsd ? Number(a.priceOverrideUsd) : undefined,
        })),
      };
    });
  }

  /**
   * Live Query: Search live tours with filters (price, destination, cruise required)
   */
  async searchLiveTours(params: {
    destination?: string;
    category?: string;
    maxPrice?: number;
    minDays?: number;
    maxDays?: number;
    locale?: string;
    limit?: number;
  }): Promise<GroundedTourEntity[]> {
    const locale = params.locale || 'en';
    const limit = Math.min(params.limit || 6, 20);

    const where: any = {
      isActive: true,
      deletedAt: null,
    };

    if (params.destination) {
      where.OR = [
        { city: { contains: params.destination, mode: 'insensitive' } },
        { country: { contains: params.destination, mode: 'insensitive' } },
        { region: { contains: params.destination, mode: 'insensitive' } },
      ];
    }

    if (params.category) {
      where.category = { contains: params.category, mode: 'insensitive' };
    }

    if (params.maxPrice && params.maxPrice > 0) {
      where.basePriceUsd = { lte: params.maxPrice };
    }

    const tours = await (this.prisma as any).tour.findMany({
      where,
      take: limit,
      orderBy: [{ isFeatured: 'desc' }, { basePriceUsd: 'asc' }],
      include: {
        images: { where: { isHero: true }, take: 1 },
      },
    });

    return tours.map((tour: any) => ({
      id: tour.id,
      slug: tour.slug,
      title: this.resolveLocalizedText(tour.titleJsonb, locale, tour.slug),
      country: tour.country || 'Egypt',
      city: tour.city || 'Cairo',
      category: tour.category || 'Luxury Tours',
      durationDays: Number(tour.durationJsonb?.days || tour.durationDays || 8),
      basePriceUsd: Number(tour.basePriceUsd) || 1890,
      currency: tour.currency || 'USD',
      isFeatured: Boolean(tour.isFeatured),
      heroImage: tour.images?.[0]?.imageUrl || '/imgs/tours/classic.webp',
      publicUrl: `/tours/${tour.slug}`,
      highlights: [],
    }));
  }

  /**
   * Live Query: Fetch luxury hotels
   */
  async getLiveHotels(city?: string, limit = 4): Promise<GroundedHotelEntity[]> {
    const where: any = {
      isActive: true,
      deletedAt: null,
    };
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    try {
      const hotels = await (this.prisma as any).hotel.findMany({
        where,
        take: limit,
        orderBy: { starRating: 'desc' },
      });

      return hotels.map((h: any) => ({
        id: h.id,
        slug: h.slug,
        name: h.name,
        city: h.city,
        country: h.country || 'Egypt',
        starRating: h.starRating || 5,
        description: h.description || '',
        amenities: h.amenities || ['Swimming Pool', 'Spa', 'Nile View', 'Fine Dining'],
        minPriceUsd: Number(h.basePriceUsd || 250),
        publicUrl: `/hotels/${h.slug}`,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Live Query: Fetch transportation fleet & transfers
   */
  async getLiveTransportation(type?: string): Promise<GroundedTransportEntity[]> {
    try {
      const services = await (this.prisma as any).transportationService.findMany({
        where: { isActive: true },
        take: 6,
      });

      return services.map((s: any) => ({
        id: s.id,
        name: s.name,
        vehicleType: s.vehicleType || 'Mercedes Luxury Sedan',
        capacity: s.capacity || 4,
        priceUsd: Number(s.basePriceUsd || 75),
        origin: s.origin || 'Cairo Airport',
        destination: s.destination || 'Cairo Hotel',
        isAvailable: true,
      }));
    } catch {
      return [];
    }
  }
}
