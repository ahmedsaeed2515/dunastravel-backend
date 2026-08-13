import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      throw new BadRequestException('Tour is already in favorites');
    }

    await this.prisma.tourFavorite.create({
      data: { userId, tourId: canonicalTourId },
    });

    return { message: 'Tour added to favorites' };
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
      throw new NotFoundException('Tour is not in favorites');
    }

    await this.prisma.tourFavorite.delete({
      where: { userId_tourId: { userId, tourId: canonicalTourId } },
    });

    return { message: 'Tour removed from favorites' };
  }

  async getFavorites(userId: string) {
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
            basePriceUsd: true,
            images: {
              where: { isHero: true },
              take: 1,
              select: { imageUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => ({
      id: f.tour.id,
      slug: f.tour.slug,
      titleJsonb: f.tour.titleJsonb,
      basePriceUsd: f.tour.basePriceUsd.toString(),
      heroImage: f.tour.images[0]?.imageUrl ?? null,
      addedAt: f.createdAt.toISOString(),
    }));
  }
}
