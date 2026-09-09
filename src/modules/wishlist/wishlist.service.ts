import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { extractI18n, extractI18nList } from '../../common/utils';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addFavorite(userId: string, tourIdOrSlug: string) {
    const tour = await this.prisma.tour.findFirst({
      where: {
        OR: [{ id: tourIdOrSlug }, { slug: tourIdOrSlug }],
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const canonicalTourId = tour.id;

    const existing = await this.prisma.tourFavorite.findUnique({
      where: { userId_tourId: { userId, tourId: canonicalTourId } },
    });

    if (existing) {
      return { message: 'Tour is already in favorites', isFavorite: true };
    }

    await this.prisma.tourFavorite.create({
      data: { userId, tourId: canonicalTourId },
    });

    return { message: 'Tour added to favorites', isFavorite: true };
  }

  async removeFavorite(userId: string, tourIdOrSlug: string) {
    const tour = await this.prisma.tour.findFirst({
      where: {
        OR: [{ id: tourIdOrSlug }, { slug: tourIdOrSlug }],
      },
      select: { id: true },
    });

    const canonicalTourId = tour ? tour.id : tourIdOrSlug;

    const existing = await this.prisma.tourFavorite.findUnique({
      where: { userId_tourId: { userId, tourId: canonicalTourId } },
    });

    if (!existing) {
      return { message: 'Tour removed from favorites', isFavorite: false };
    }

    await this.prisma.tourFavorite.delete({
      where: { userId_tourId: { userId, tourId: canonicalTourId } },
    });

    return { message: 'Tour removed from favorites', isFavorite: false };
  }

  async getFavorites(userId: string, lang: string = 'en') {
    const favorites = await this.prisma.tourFavorite.findMany({
      where: {
        userId,
        tour: {
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
        },
      },
      include: {
        tour: {
          select: {
            id: true,
            slug: true,
            titleJsonb: true,
            subtitleJsonb: true,
            category: true,
            basePriceUsd: true,
            currency: true,
            durationJsonb: true,
            overviewJsonb: true,
            highlightsJsonb: true,
            includedServicesJsonb: true,
            excludedServicesJsonb: true,
            minPaxJsonb: true,
            country: true,
            city: true,
            region: true,
            market: true,
            languages: true,
            isFeatured: true,
            displayOrder: true,
            sourceRating: true,
            sourceReviewCount: true,
            difficultyLevel: true,
            images: {
              orderBy: [{ isHero: 'desc' }, { sortOrder: 'asc' }],
              select: {
                id: true,
                imageUrl: true,
                isHero: true,
                altText: true,
                sortOrder: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => {
      const tour = f.tour;
      const heroImage =
        tour.images.find((img) => img.isHero)?.imageUrl ??
        tour.images[0]?.imageUrl ??
        null;
      const parsedBasePrice = new Prisma.Decimal(tour.basePriceUsd).toFixed(2);

      return {
        id: tour.id,
        slug: tour.slug,
        title: extractI18n(tour.titleJsonb, lang),
        titleJsonb: tour.titleJsonb,
        subtitle: extractI18n(tour.subtitleJsonb, lang),
        subtitleJsonb: tour.subtitleJsonb,
        category: tour.category,
        basePriceUsd: parsedBasePrice,
        price: Number(parsedBasePrice),
        currency: tour.currency,
        duration: extractI18n(tour.durationJsonb, lang),
        durationJsonb: tour.durationJsonb,
        overview: extractI18n(tour.overviewJsonb, lang),
        overviewJsonb: tour.overviewJsonb,
        highlights: extractI18nList(tour.highlightsJsonb, lang),
        highlightsJsonb: tour.highlightsJsonb,
        includedServices: extractI18nList(tour.includedServicesJsonb, lang),
        excludedServices: extractI18nList(tour.excludedServicesJsonb, lang),
        minPax: extractI18n(tour.minPaxJsonb, lang),
        minPaxJsonb: tour.minPaxJsonb,
        heroImage,
        images: tour.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isHero: img.isHero,
          altText: img.altText,
          sortOrder: img.sortOrder,
        })),
        country: tour.country,
        city: tour.city,
        region: tour.region,
        market: tour.market,
        rating: tour.sourceRating ? Number(tour.sourceRating) : 5,
        sourceRating: tour.sourceRating ? tour.sourceRating.toString() : null,
        reviewsCount: tour.sourceReviewCount ?? 0,
        sourceReviewCount: tour.sourceReviewCount ?? null,
        difficultyLevel: tour.difficultyLevel,
        languages: tour.languages,
        isFeatured: tour.isFeatured,
        destination: tour.city || tour.country || '',
        addedAt: f.createdAt.toISOString(),
      };
    });
  }
}
