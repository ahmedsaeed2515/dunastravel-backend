import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GroundedTourRecommendation {
  id: string;
  slug: string;
  title: string;
  category?: string;
  destination: string;
  price: number;
  currency: string;
  durationDays?: number;
  image?: string;
  publicUrl: string;
  reason?: string;
}

export interface GroundedDestinationRecommendation {
  id: string;
  slug: string;
  title: string;
  country?: string;
  heroImage?: string;
  publicUrl: string;
}

@Injectable()
export class TourCatalogToolService {
  private readonly logger = new Logger(TourCatalogToolService.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchGroundedTours(
    keywords: string[],
    limit: number = 4,
  ): Promise<GroundedTourRecommendation[]> {
    try {
      if (!keywords || keywords.length === 0) {
        // Return top featured active tours
        const tours = await this.prisma.tour.findMany({
          where: {
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          take: limit,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
          include: {
            images: {
              where: { isHero: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
        });

        return tours.map((t) => this.mapTourToRecommendation(t));
      }

      // Build OR conditions for searching keywords in city, country, region, category, tags
      const searchConditions = keywords.flatMap((kw) => [
        { city: { contains: kw, mode: 'insensitive' as const } },
        { country: { contains: kw, mode: 'insensitive' as const } },
        { region: { contains: kw, mode: 'insensitive' as const } },
        { category: { contains: kw, mode: 'insensitive' as const } },
      ]);

      const tours = await this.prisma.tour.findMany({
        where: {
          isActive: true,
          status: 'PUBLISHED',
          deletedAt: null,
          OR: searchConditions,
        },
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        include: {
          images: {
            take: 1,
            select: { imageUrl: true },
          },
        },
      });

      return tours.map((t) => this.mapTourToRecommendation(t));
    } catch (err: any) {
      this.logger.error(`Failed to search grounded tours: ${err.message}`);
      return [];
    }
  }

  async searchGroundedDestinations(
    keywords: string[],
    limit: number = 3,
  ): Promise<GroundedDestinationRecommendation[]> {
    try {
      const searchConditions = keywords.flatMap((kw) => [
        { slug: { contains: kw, mode: 'insensitive' as const } },
        { type: { contains: kw, mode: 'insensitive' as const } },
      ]);

      const landingPages = await this.prisma.tourLandingPage.findMany({
        where: {
          isActive: true,
          status: 'PUBLISHED',
          deletedAt: null,
          ...(searchConditions.length > 0 ? { OR: searchConditions } : {}),
        },
        take: limit,
        orderBy: { sortOrder: 'asc' },
      });

      return landingPages.map((lp) => {
        let title = lp.slug.toUpperCase();
        if (lp.titleJsonb && typeof lp.titleJsonb === 'object') {
          const tMap = lp.titleJsonb as Record<string, string>;
          title = tMap.en || tMap.ar || title;
        }

        return {
          id: lp.id,
          slug: lp.slug,
          title,
          heroImage: lp.heroImageUrl || undefined,
          publicUrl: `/destinations/${lp.slug}`,
        };
      });
    } catch (err: any) {
      this.logger.error(`Failed to search destinations: ${err.message}`);
      return [];
    }
  }

  private mapTourToRecommendation(tour: any): GroundedTourRecommendation {
    let title = tour.slug;
    if (tour.titleJsonb && typeof tour.titleJsonb === 'object') {
      const tMap = tour.titleJsonb as Record<string, string>;
      title = tMap.en || tMap.ar || title;
    }

    const image = tour.images?.[0]?.imageUrl || undefined;
    const dest = [tour.city, tour.country].filter(Boolean).join(', ') || 'Egypt';

    return {
      id: tour.id,
      slug: tour.slug,
      title,
      category: tour.category || 'Luxury',
      destination: dest,
      price: Number(tour.basePriceUsd),
      currency: tour.currency || 'USD',
      image,
      publicUrl: `/tours/${tour.slug}`,
    };
  }
}
