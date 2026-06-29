import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extractI18n,
  getPaginationParams,
  paginate,
  PaginatedResponse,
} from '../../common/utils';
import { GetToursQueryDto } from './dto';
import {
  TourSummaryResponse,
  TourDetailResponse,
  TourItineraryResponse,
  TourImageResponse,
} from './types';
import { Prisma } from '@prisma/client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class ToursService {
  private readonly logger = new Logger(ToursService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectMetric('tours_viewed_total')
    private readonly toursCounter: Counter<string>,
  ) {}

  async findAll(
    query: GetToursQueryDto,
  ): Promise<PaginatedResponse<TourSummaryResponse>> {
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );

    const where: Prisma.TourWhereInput = { isActive: true };
    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    const [total, records] = await this.prisma.$transaction([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          titleJsonb: true,
          category: true,
          basePriceUsd: true,
          durationJsonb: true,
          images: {
            where: { isHero: true },
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { imageUrl: true },
          },
        },
      }),
    ]);

    this.logger.debug(
      `Tours catalog queried | category=${query.category ?? 'all'} lang=${query.lang} page=${page} limit=${limit}`,
    );

    const mappedItems: TourSummaryResponse[] = records.map((record) => ({
      id: record.id,
      slug: record.slug,
      title: extractI18n(record.titleJsonb, query.lang),
      category: record.category,
      basePriceUsd: record.basePriceUsd.toString(),
      duration: extractI18n(record.durationJsonb, query.lang),
      heroImage: record.images[0]?.imageUrl ?? null,
    }));

    return paginate(mappedItems, total, page, limit);
  }

  async findBySlug(slug: string, lang: string): Promise<TourDetailResponse> {
    this.toursCounter.inc();
    const cacheKey = `tour:${slug}:${lang}`;
    const cached = await this.cacheManager.get<TourDetailResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const tour = await this.prisma.tour.findFirst({
      where: { slug, isActive: true },
      include: {
        itineraries: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!tour) {
      this.logger.warn(`Tour not found | slug=${slug}`);
      throw new NotFoundException('Tour not found');
    }

    this.logger.debug(`Tour detail queried | slug=${slug} lang=${lang}`);

    const itinerary: TourItineraryResponse[] = tour.itineraries.map((it) => ({
      id: it.id,
      dayLabel: it.dayLabel,
      description: extractI18n(it.descriptionJsonb, lang),
      meals: it.mealsJsonb ? extractI18n(it.mealsJsonb, lang) || null : null,
      sortOrder: it.sortOrder,
    }));

    const images: TourImageResponse[] = tour.images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isHero: img.isHero,
      altText: img.altText,
      sortOrder: img.sortOrder,
    }));

    const response: TourDetailResponse = {
      id: tour.id,
      slug: tour.slug,
      title: extractI18n(tour.titleJsonb, lang),
      category: tour.category,
      basePriceUsd: tour.basePriceUsd.toString(),
      duration: extractI18n(tour.durationJsonb, lang),
      overview: extractI18n(tour.overviewJsonb, lang),
      itinerary,
      images,
    };

    await this.cacheManager.set(cacheKey, response, 300); // cache for 5 minutes
    return response;
  }

  async update(slug: string, data: any) {
    const updated = await this.prisma.tour.update({
      where: { slug },
      data,
    });
    // Invalidate cache immediately after update
    // We should ideally clear all langs, but we don't know which ones are cached.
    // For now, we'll clear the known ones or just use a pattern if supported.
    // cache-manager-redis-yet doesn't support wildcard del by default, but we can clear specific ones.
    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const l of langs) {
      await this.cacheManager.del(`tour:${slug}:${l}`);
    }
    return updated;
  }

  async remove(slug: string) {
    const deleted = await this.prisma.tour.delete({
      where: { slug },
    });
    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const l of langs) {
      await this.cacheManager.del(`tour:${slug}:${l}`);
    }
    return deleted;
  }
}
