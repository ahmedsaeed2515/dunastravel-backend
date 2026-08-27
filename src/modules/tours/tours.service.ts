import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extractI18n,
  extractI18nList,
  getPaginationParams,
  paginate,
  PaginatedResponse,
} from '../../common/utils';
import { GetToursQueryDto, CreateTourReviewDto } from './dto';
import {
  TourSummaryResponse,
  TourDetailResponse,
  TourPreviewResponse,
  TourItineraryResponse,
  TourImageResponse,
} from './types';
import { Prisma } from '@prisma/client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

type TourWithPresentation = Prisma.TourGetPayload<{
  include: { itineraries: true; images: true };
}>;

function extractStructuredI18n(value: unknown, lang: string): unknown {
  if (Array.isArray(value)) return value.map((item) => extractStructuredI18n(item, lang));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const localized = record[lang] ?? record.en;
  if (
    localized !== undefined &&
    Object.keys(record).every((key) => ['ar', 'en', 'es', 'pt', 'it'].includes(key))
  ) {
    return localized;
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, extractStructuredI18n(child, lang)]),
  );
}

const DESTINATION_SLUG_ALIASES: Record<string, string> = {
  'united-arab-emirates': 'dubai',
  uae: 'dubai',
  'u-a-e': 'dubai',
  egipto: 'egypt',
  egito: 'egypt',
  turquia: 'turkey',
  turkiye: 'turkey',
  jordania: 'jordan',
  'multi-country': 'multi-country',
  multicountry: 'multi-country',
};

/**
 * Public destination filters address canonical landing-page slugs.  Country
 * labels are presentation data (for example, Dubai tours are stored under
 * "United Arab Emirates") and must not decide which destination owns a tour.
 */
export function canonicalDestinationSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return DESTINATION_SLUG_ALIASES[normalized] ?? normalized;
}

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

    const cacheKey = `tours:catalog:${query.lang || 'en'}:${query.category || ''}:${query.destination || query.country || ''}:${query.city || ''}:${query.search || ''}:${query.isFeatured ?? ''}:${query.sortPrice || ''}:${page}:${limit}`;
    const cached = await this.cacheManager.get<PaginatedResponse<TourSummaryResponse>>(cacheKey);
    if (cached) {
      return cached;
    }

    const where: Prisma.TourWhereInput = {
      isActive: true,
      status: 'PUBLISHED',
      deletedAt: null,
    };
    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }
    if (query.destination) {
      where.landingPages = {
        some: {
          isVisible: true,
          landingPage: {
            slug: canonicalDestinationSlug(query.destination),
            type: 'DESTINATION',
            status: 'PUBLISHED',
            isActive: true,
            deletedAt: null,
          },
        },
      };
    }
    if (query.country) {
      where.country = { equals: query.country, mode: 'insensitive' };
    }
    if (query.city) {
      where.city = { equals: query.city, mode: 'insensitive' };
    }
    if (query.region) {
      where.region = { equals: query.region, mode: 'insensitive' };
    }
    if (query.isFeatured !== undefined) {
      where.isFeatured = query.isFeatured;
    }
    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.basePriceUsd = {};
      if (query.priceMin !== undefined) where.basePriceUsd.gte = query.priceMin;
      if (query.priceMax !== undefined) where.basePriceUsd.lte = query.priceMax;
    }
    if (query.search) {
      where.OR = [
        { slug: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
        { region: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.TourOrderByWithRelationInput = query.sortPrice
      ? { basePriceUsd: query.sortPrice }
      : { createdAt: 'desc' };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          slug: true,
          titleJsonb: true,
          category: true,
          basePriceUsd: true,
          durationJsonb: true,
          country: true,
          languages: true,
          images: {
            take: 1,
            orderBy: [{ isHero: 'desc' }, { sortOrder: 'asc' }],
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
      basePriceUsd: new Prisma.Decimal(record.basePriceUsd).toFixed(2),
      duration: extractI18n(record.durationJsonb, query.lang),
      heroImage: record.images[0]?.imageUrl ?? null,
      country: record.country,
      languages: record.languages,
    }));

    const result = paginate(mappedItems, total, page, limit);
    await this.cacheManager.set(cacheKey, result, 60_000); // cache for 60 seconds
    return result;
  }

  async findBySlug(slug: string, lang: string): Promise<TourDetailResponse> {
    this.toursCounter.inc();
    const cacheKey = `tour:${slug}:${lang}`;
    const cached = await this.cacheManager.get<TourDetailResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const tour = await this.prisma.tour.findFirst({
      where: { slug, isActive: true, status: 'PUBLISHED', deletedAt: null },
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

    const response = this.toTourDetailResponse(tour, lang);

    await this.cacheManager.set(cacheKey, response, 300_000); // cache for 5 minutes
    return response;
  }

  /**
   * Admin-only preview lookup. It deliberately bypasses the public cache so a
   * draft or archived representation can never be served by public endpoints.
   */
  async findPreviewBySlug(
    slug: string,
    lang: string,
  ): Promise<TourPreviewResponse> {
    const tour = await this.prisma.tour.findFirst({
      where: { slug, deletedAt: null },
      include: {
        itineraries: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!tour) {
      throw new NotFoundException('Tour not found');
    }

    this.logger.debug(`Admin tour preview queried | slug=${slug} lang=${lang}`);
    return {
      ...this.toTourDetailResponse(tour, lang),
      preview: {
        status: tour.status,
        isActive: tour.isActive,
        isPublic: tour.status === 'PUBLISHED' && tour.isActive,
      },
    };
  }

  private toTourDetailResponse(
    tour: TourWithPresentation,
    lang: string,
  ): TourDetailResponse {
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

    return {
      id: tour.id,
      slug: tour.slug,
      title: extractI18n(tour.titleJsonb, lang),
      subtitle: tour.subtitleJsonb ? extractI18n(tour.subtitleJsonb, lang) || null : null,
      category: tour.category,
      basePriceUsd: new Prisma.Decimal(tour.basePriceUsd).toFixed(2),
      currency: tour.currency,

      duration: extractI18n(tour.durationJsonb, lang),
      overview: extractI18n(tour.overviewJsonb, lang),
      highlights: extractI18nList(tour.highlightsJsonb, lang),
      departureInfo: tour.departureInfoJsonb
        ? extractI18n(tour.departureInfoJsonb, lang) || null
        : null,
      sourceCode: tour.sourceCodeJsonb
        ? extractI18n(tour.sourceCodeJsonb, lang) || null
        : null,
      market: tour.market,
      sourceRating: tour.sourceRating
        ? new Prisma.Decimal(tour.sourceRating).toFixed(2)
        : null,
      sourceReviewCount: tour.sourceReviewCount,
      cancellationPolicy: tour.cancellationPolicyJsonb
        ? extractI18n(tour.cancellationPolicyJsonb, lang)
        : null,
      includedServices: extractI18nList(tour.includedServicesJsonb, lang),
      excludedServices: extractI18nList(tour.excludedServicesJsonb, lang),
      hotelInfo: tour.hotelInfoJsonb
        ? extractStructuredI18n(tour.hotelInfoJsonb, lang)
        : null,
      seasonPricing: tour.seasonPricingJsonb
        ? extractStructuredI18n(tour.seasonPricingJsonb, lang)
        : null,
      transportation: tour.transportationJsonb
        ? extractStructuredI18n(tour.transportationJsonb, lang)
        : null,
      terms: tour.termsJsonb ? extractStructuredI18n(tour.termsJsonb, lang) : null,
      tags: tour.tags,
      difficultyLevel: tour.difficultyLevel,
      meetingPoint: tour.meetingPoint,
      country: tour.country,
      languages: tour.languages,
      isFeatured: tour.isFeatured,

      itinerary,
      images,
    };
  }

  async update(slug: string, data: Prisma.TourUpdateInput) {
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
  async getTourReviews(
    slug: string,
    pageVal: number = 1,
    limitVal: number = 10,
  ): Promise<PaginatedResponse<any>> {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);

    const tour = await this.prisma.tour.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const [total, records] = await this.prisma.$transaction([
      this.prisma.tourReview.count({
        where: {
          tourId: tour.id,
          isPublished: true,
          status: 'APPROVED',
          deletedAt: null,
        },
      }),
      this.prisma.tourReview.findMany({
        where: {
          tourId: tour.id,
          isPublished: true,
          status: 'APPROVED',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewerName: r.reviewerName,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }));

    return paginate(data, total, page, limit);
  }

  async addTourReview(slug: string, userId: string, dto: CreateTourReviewDto) {
    const tour = await this.prisma.tour.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const hasCompletedBooking = await this.prisma.booking.findFirst({
      where: {
        tourId: tour.id,
        userId: userId,
        status: 'COMPLETED',
        deletedAt: null,
        reviews: { none: {} },
      },
      select: { id: true },
    });

    if (!hasCompletedBooking) {
      throw new BadRequestException(
        'You must have a COMPLETED booking for this tour to leave a review.',
      );
    }

    const reviewer = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true },
    });
    if (!reviewer) throw new NotFoundException('User not found');

    const review = await this.prisma.tourReview.create({
      data: {
        tourId: tour.id,
        userId,
        bookingId: hasCompletedBooking.id,
        rating: dto.rating,
        reviewerName: sanitizePlainText(reviewer.name).slice(0, 255),
        comment: dto.comment
          ? sanitizePlainText(dto.comment).slice(0, 5000)
          : null,
        status: 'PENDING',
        isPublished: false,
      },
    });

    return {
      message: 'Review submitted successfully and is pending approval.',
      reviewId: review.id,
    };
  }
}
