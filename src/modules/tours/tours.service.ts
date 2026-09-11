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

    const where: Prisma.TourWhereInput = {
      isActive: true,
      status: 'PUBLISHED',
      deletedAt: null,
    };
    if (query.category) {
      const catTrim = query.category.trim();
      const catLower = catTrim.toLowerCase();
      if (catLower.includes('multi')) {
        where.OR = [
          { category: { contains: 'multi', mode: 'insensitive' } },
          { category: { contains: 'متعددة' } },
        ];
      } else {
        where.category = { contains: catTrim, mode: 'insensitive' };
      }
    }
    if (query.destination) {
      const canonSlug = canonicalDestinationSlug(query.destination);
      const isMulti = canonSlug === 'multi-country';
      const destinationCondition: Prisma.TourWhereInput = {
        landingPages: {
          some: {
            isVisible: true,
            landingPage: {
              slug: canonSlug,
              type: 'DESTINATION',
              status: 'PUBLISHED',
              isActive: true,
              deletedAt: null,
            },
          },
        },
      };

      if (isMulti) {
        const multiConditions: Prisma.TourWhereInput[] = [
          destinationCondition,
          { category: { contains: 'multi', mode: 'insensitive' } },
          { category: { contains: 'متعددة' } },
          { country: { equals: 'Multi-Country', mode: 'insensitive' } },
        ];
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: multiConditions },
          ];
          delete where.OR;
        } else {
          where.OR = multiConditions;
        }
      } else {
        where.landingPages = destinationCondition.landingPages;
      }
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

    const orderBy: Prisma.TourOrderByWithRelationInput[] = query.sortPrice
      ? [{ basePriceUsd: query.sortPrice }]
      : [
          { isFeatured: 'desc' },
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ];

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
          currency: true,
          durationJsonb: true,
          overviewJsonb: true,
          highlightsJsonb: true,
          includedServicesJsonb: true,
          excludedServicesJsonb: true,
          country: true,
          city: true,
          languages: true,
          isFeatured: true,
          displayOrder: true,
          images: {
            take: 10,
            orderBy: [{ isHero: 'desc' }, { sortOrder: 'asc' }],
            select: { imageUrl: true, isHero: true, sortOrder: true },
          },
        },
      }),
    ]);

    this.logger.debug(
      `Tours catalog queried | category=${query.category ?? 'all'} lang=${query.lang} page=${page} limit=${limit}`,
    );

    const mappedItems: TourSummaryResponse[] = records.map((record) => {
      const heroUrl = record.images.find((img) => img.isHero)?.imageUrl ?? record.images[0]?.imageUrl ?? null;
      return {
        id: record.id,
        slug: record.slug,
        title: extractI18n(record.titleJsonb, query.lang),
        category: record.category,
        basePriceUsd: new Prisma.Decimal(record.basePriceUsd).toFixed(2),
        currency: record.currency,
        duration: extractI18n(record.durationJsonb, query.lang),
        overview: extractI18n(record.overviewJsonb, query.lang),
        highlights: extractI18nList(record.highlightsJsonb, query.lang),
        includedServices: extractI18nList(record.includedServicesJsonb, query.lang),
        excludedServices: extractI18nList(record.excludedServicesJsonb, query.lang),
        heroImage: heroUrl,
        heroImageUrl: heroUrl,
        images: record.images.map((img) => img.imageUrl),
        country: record.country,
        city: record.city,
        languages: record.languages,
        isFeatured: record.isFeatured,
        displayOrder: record.displayOrder ?? 0,
      };
    });

    // Visibility may change through either a tour lifecycle action or an
    // interface relation action.  Do not cache this public catalogue without
    // a shared relation-aware invalidation key, otherwise an unpublished or
    // hidden tour can remain visible until its TTL expires.
    return paginate(mappedItems, total, page, limit);
  }

  async findBySlug(rawSlug: string, lang: string): Promise<TourDetailResponse> {
    const trimmed = rawSlug?.trim();
    if (!trimmed) {
      throw new NotFoundException('Tour not found');
    }

    this.toursCounter.inc();
    const cacheKey = `tour:detail:${trimmed}:${lang}`;
    const cached = await this.cacheManager.get<TourDetailResponse>(cacheKey);
    if (cached) return cached;

    // 1. First attempt: match by exact slug or id
    let tour = await this.prisma.tour.findFirst({
      where: {
        OR: [
          { slug: trimmed },
          { id: trimmed },
        ],
        isActive: true,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        itineraries: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    // 2. Second attempt: check only true legacy generic aliases if exact match failed
    if (!tour) {
      const GENERIC_ALIASES: Record<string, string> = {
        'classic': 'classic-program',
        'honeymooners': 'honeymoon-egypt',
        'reg-21-jordan-extension-4-days': 'reg-21-jordan-extension---4-days',
        'reg-20-jordan-extension-5-days': 'reg-20-jordan-extension---5-days',
        'reg-21': 'reg-21-jordan-extension---4-days',
        'reg-20': 'reg-20-jordan-extension---5-days',
      };
      const aliasTarget = GENERIC_ALIASES[trimmed];
      if (aliasTarget) {
        tour = await this.prisma.tour.findFirst({
          where: {
            OR: [{ slug: aliasTarget }, { id: aliasTarget }],
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          include: {
            itineraries: { orderBy: { sortOrder: 'asc' } },
            images: { orderBy: { sortOrder: 'asc' } },
          },
        });
      }
    }

    if (!tour) {
      this.logger.warn(`Tour not found | slug=${trimmed}`);
      throw new NotFoundException('Tour not found');
    }

    this.logger.debug(`Tour detail queried | slug=${tour.slug} lang=${lang}`);

    const response = this.toTourDetailResponse(tour, lang);
    await this.cacheManager.set(cacheKey, response, 60_000);

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
    const itinerary: TourItineraryResponse[] = tour.itineraries.map((it: any) => {
      const localizedTitle = it.titleJsonb ? extractI18n(it.titleJsonb, lang) : null;
      return {
        id: it.id,
        dayLabel: localizedTitle || it.dayLabel,
        title: localizedTitle || it.dayLabel,
        titleJsonb: it.titleJsonb,
        description: extractI18n(it.descriptionJsonb, lang),
        meals: it.mealsJsonb ? extractI18n(it.mealsJsonb, lang) || null : null,
        sortOrder: it.sortOrder,
        activities: it.activitiesJsonb ? extractI18n(it.activitiesJsonb, lang) || null : null,
        hotels: it.hotelsJsonb ? extractI18n(it.hotelsJsonb, lang) || null : null,
        notes: it.notesJsonb ? extractI18n(it.notesJsonb, lang) || null : null,
        transportation: it.transportationJsonb ? extractI18n(it.transportationJsonb, lang) || null : null,
      };
    });

    const images: TourImageResponse[] = tour.images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isHero: img.isHero,
      altText: img.altText,
      sortOrder: img.sortOrder,
      isVideo: img.isVideo,
      videoUrl: img.videoUrl,
    }));

    const heroImgObj = tour.images.find((img) => img.isHero) || tour.images[0];
    const heroImage = heroImgObj?.imageUrl || null;
    const heroVideoObj = tour.images.find((img) => img.isVideo && img.videoUrl);
    const heroVideoUrl = heroVideoObj?.videoUrl || null;

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
      city: tour.city,
      minPax: tour.minPaxJsonb ? extractI18n(tour.minPaxJsonb, lang) || null : null,
      departureTime: tour.departureTime,
      returnTime: tour.returnTime,
      ageRestrictions: tour.ageRestrictions,
      pickupLocations: tour.pickupLocationsJsonb ? extractI18nList(tour.pickupLocationsJsonb, lang) : null,
      seoTitle: tour.seoTitle,
      seoDescription: tour.seoDescription,
      customBadge: null,
      heroImage,
      heroVideoUrl,
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
    // Invalidate detail and list cache immediately after update
    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const l of langs) {
      await this.cacheManager.del(`tour:detail:${slug}:${l}`);
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
      await this.cacheManager.del(`tour:detail:${slug}:${l}`);
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
