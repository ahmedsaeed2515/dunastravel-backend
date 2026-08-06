import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateTourLandingPageDto } from './dto/create-tour-landing-page.dto';
import { UpdateTourLandingPageDto } from './dto/update-tour-landing-page.dto';
import {
  AttachToursDto,
  UpdateTourRelationDto,
  ReorderToursDto,
} from './dto/attach-tours.dto';
import { extractI18n, getPaginationParams, paginate } from '../../common/utils';
import {
  sanitizeHtmlContent,
  sanitizePlainText,
} from '../../common/utils/content-sanitizer.util';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

@Injectable()
export class TourLandingPagesService {
  private readonly logger = new Logger(TourLandingPagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calculateLocaleCompletion(landingPage: any) {
    const completion: Record<
      string,
      {
        title: boolean;
        subtitle: boolean;
        description: boolean;
        isComplete: boolean;
      }
    > = {};
    const titleObj =
      (landingPage.titleJsonb as Record<string, string> | null) || {};
    const subObj =
      (landingPage.subtitleJsonb as Record<string, string> | null) || {};
    const descObj =
      (landingPage.descriptionJsonb as Record<string, string> | null) || {};

    for (const locale of SUPPORTED_LOCALES) {
      const titleVal = titleObj[locale];
      const subVal = subObj[locale];
      const descVal = descObj[locale];
      const hasTitle = Boolean(typeof titleVal === 'string' && titleVal.trim());
      const hasSub = Boolean(typeof subVal === 'string' && subVal.trim());
      const hasDesc = Boolean(typeof descVal === 'string' && descVal.trim());
      completion[locale] = {
        title: hasTitle,
        subtitle: hasSub,
        description: hasDesc,
        isComplete: hasTitle && hasDesc,
      };
    }
    return completion;
  }

  // --- ADMIN METHODS ---

  async findAllAdmin(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    isActive?: string | boolean;
  }) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const { search, status, type, isActive } = query;

    const where: Prisma.TourLandingPageWhereInput = {
      deletedAt: null,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (isActive !== undefined)
      where.isActive = isActive === 'true' || isActive === true;
    if (search) {
      where.OR = [{ slug: { contains: search, mode: 'insensitive' } }];
    }

    const [total, items] = await Promise.all([
      this.prisma.tourLandingPage.count({ where }),
      this.prisma.tourLandingPage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          tours: {
            include: {
              tour: {
                select: {
                  id: true,
                  slug: true,
                  titleJsonb: true,
                  isActive: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedItems = items.map((lp) => {
      const completion = this.calculateLocaleCompletion(lp);
      const totalTours = lp.tours.length;
      const activeTours = lp.tours.filter(
        (t) => t.tour.isActive && t.tour.status === 'PUBLISHED',
      ).length;

      return {
        ...lp,
        translationCompletion: completion,
        totalToursCount: totalTours,
        activeToursCount: activeTours,
      };
    });

    return paginate(formattedItems, total, page, limit);
  }

  async findOneAdmin(idOrSlug: string) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
      include: {
        tours: {
          orderBy: { sortOrder: 'asc' },
          include: {
            tour: {
              include: {
                images: {
                  where: { isHero: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!landingPage) {
      throw new NotFoundException(`Tour landing page '${idOrSlug}' not found`);
    }

    const completion = this.calculateLocaleCompletion(landingPage);

    return {
      ...landingPage,
      translationCompletion: completion,
    };
  }

  async createAdmin(dto: CreateTourLandingPageDto) {
    const existing = await this.prisma.tourLandingPage.findUnique({
      where: { slug: dto.slug },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Landing page with slug '${dto.slug}' already exists.`,
      );
    }

    const status = dto.status ?? 'DRAFT';
    const created = await this.prisma.tourLandingPage.create({
      data: {
        slug: dto.slug.toLowerCase(),
        type: dto.type || 'DESTINATION',
        titleJsonb: this.sanitizeLocalized(
          dto.titleJsonb,
          'titleJsonb',
          255,
          false,
          true,
        ),
        subtitleJsonb: this.sanitizeLocalized(
          dto.subtitleJsonb,
          'subtitleJsonb',
          500,
        ),
        descriptionJsonb: this.sanitizeLocalized(
          dto.descriptionJsonb,
          'descriptionJsonb',
          20_000,
          true,
        ),
        briefJsonb: this.sanitizeLocalized(
          dto.briefJsonb,
          'briefJsonb',
          5_000,
          true,
        ),
        heroImageUrl: dto.heroImageUrl || null,
        heroVideoUrl: dto.heroVideoUrl || null,
        seoTitleJsonb: this.sanitizeLocalized(
          dto.seoTitleJsonb,
          'seoTitleJsonb',
          255,
        ),
        seoDescriptionJsonb: this.sanitizeLocalized(
          dto.seoDescriptionJsonb,
          'seoDescriptionJsonb',
          500,
        ),
        seoKeywordsJsonb: this.sanitizeLocalized(
          dto.seoKeywordsJsonb,
          'seoKeywordsJsonb',
          500,
        ),
        sectionsJsonb: this.sanitizeSections(dto.sectionsJsonb),
        status,
        isActive: status === 'PUBLISHED' && dto.isActive === true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return this.findOneAdmin(created.id);
  }

  async updateAdmin(idOrSlug: string, dto: UpdateTourLandingPageDto) {
    const existing = await this.prisma.tourLandingPage.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Tour landing page '${idOrSlug}' not found`);
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugConflict = await this.prisma.tourLandingPage.findUnique({
        where: { slug: dto.slug },
      });
      if (slugConflict && slugConflict.id !== existing.id) {
        throw new ConflictException(
          `Landing page with slug '${dto.slug}' already exists.`,
        );
      }
    }

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        ...(dto.slug && { slug: dto.slug.toLowerCase() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.titleJsonb && {
          titleJsonb: this.sanitizeLocalized(
            dto.titleJsonb,
            'titleJsonb',
            255,
            false,
            true,
          ),
        }),
        ...(dto.subtitleJsonb && {
          subtitleJsonb: this.sanitizeLocalized(
            dto.subtitleJsonb,
            'subtitleJsonb',
            500,
          ),
        }),
        ...(dto.descriptionJsonb && {
          descriptionJsonb: this.sanitizeLocalized(
            dto.descriptionJsonb,
            'descriptionJsonb',
            20_000,
            true,
          ),
        }),
        ...(dto.briefJsonb && {
          briefJsonb: this.sanitizeLocalized(
            dto.briefJsonb,
            'briefJsonb',
            5_000,
            true,
          ),
        }),
        ...(dto.heroImageUrl !== undefined && {
          heroImageUrl: dto.heroImageUrl,
        }),
        ...(dto.heroVideoUrl !== undefined && {
          heroVideoUrl: dto.heroVideoUrl,
        }),
        ...(dto.seoTitleJsonb && {
          seoTitleJsonb: this.sanitizeLocalized(
            dto.seoTitleJsonb,
            'seoTitleJsonb',
            255,
          ),
        }),
        ...(dto.seoDescriptionJsonb && {
          seoDescriptionJsonb: this.sanitizeLocalized(
            dto.seoDescriptionJsonb,
            'seoDescriptionJsonb',
            500,
          ),
        }),
        ...(dto.seoKeywordsJsonb && {
          seoKeywordsJsonb: this.sanitizeLocalized(
            dto.seoKeywordsJsonb,
            'seoKeywordsJsonb',
            500,
          ),
        }),
        ...(dto.sectionsJsonb && {
          sectionsJsonb: this.sanitizeSections(dto.sectionsJsonb),
        }),
        ...(dto.status && { status: dto.status }),
        ...(dto.status
          ? {
              isActive:
                dto.status === 'PUBLISHED' && dto.isActive === true,
            }
          : dto.isActive !== undefined && {
              isActive: existing.status === 'PUBLISHED' && dto.isActive,
            }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    return this.findOneAdmin(existing.id);
  }

  async setStatusAdmin(idOrSlug: string, status: string, isActive?: boolean) {
    const existing = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!existing)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        status,
        isActive: status === 'PUBLISHED' && isActive === true,
      },
    });

    return this.findOneAdmin(existing.id);
  }

  async softDeleteAdmin(idOrSlug: string) {
    const existing = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!existing)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      success: true,
      message: `Landing page '${existing.slug}' deleted.`,
    };
  }

  async reorderInterfacesAdmin(items: { id: string; sortOrder: number }[]) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.tourLandingPage.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true, count: items.length };
  }

  // --- TOUR RELATION MANAGEMENT ---

  async attachTours(idOrSlug: string, dto: AttachToursDto) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    const tourIds = [...new Set(dto.tourIds)];
    const tours = await this.prisma.tour.findMany({
      where: { id: { in: tourIds }, deletedAt: null },
      select: { id: true },
    });
    if (tours.length !== tourIds.length) {
      throw new BadRequestException('One or more tours are invalid');
    }

    const customBadge = dto.customBadge
      ? this.sanitizeLocalized(dto.customBadge, 'customBadge', 100)
      : Prisma.JsonNull;
    await this.prisma.$transaction(
      async (tx) => {
        const highestOrder = await tx.tourLandingPageTour.aggregate({
          where: { landingPageId: landingPage.id },
          _max: { sortOrder: true },
        });
        let currentOrder = (highestOrder._max.sortOrder || 0) + 1;

        for (const tourId of tourIds) {
          await tx.tourLandingPageTour.upsert({
            where: {
              landingPageId_tourId: {
                landingPageId: landingPage.id,
                tourId,
              },
            },
            create: {
              landingPageId: landingPage.id,
              tourId,
              sortOrder: currentOrder++,
              isFeatured: dto.isFeatured ?? false,
              isVisible: dto.isVisible ?? true,
              customBadge,
            },
            update: {
              isVisible: dto.isVisible ?? true,
              ...(dto.isFeatured !== undefined && {
                isFeatured: dto.isFeatured,
              }),
              ...(dto.customBadge !== undefined && { customBadge }),
            },
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );

    return this.findOneAdmin(landingPage.id);
  }

  async detachTour(idOrSlug: string, tourId: string) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPageTour.deleteMany({
      where: {
        landingPageId: landingPage.id,
        tourId,
      },
    });

    return {
      success: true,
      message: `Tour '${tourId}' detached from interface '${landingPage.slug}'. Global tour remains intact.`,
    };
  }

  async updateTourRelation(
    idOrSlug: string,
    tourId: string,
    dto: UpdateTourRelationDto,
  ) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    const relation = await this.prisma.tourLandingPageTour.findUnique({
      where: {
        landingPageId_tourId: { landingPageId: landingPage.id, tourId },
      },
    });
    if (!relation) throw new NotFoundException(`Relation not found.`);

    await this.prisma.tourLandingPageTour.update({
      where: { id: relation.id },
      data: {
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.customBadge !== undefined && {
          customBadge: this.sanitizeLocalized(
            dto.customBadge,
            'customBadge',
            100,
          ),
        }),
      },
    });

    return this.findOneAdmin(landingPage.id);
  }

  async reorderToursInInterface(idOrSlug: string, dto: ReorderToursDto) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage)
      throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.tourLandingPageTour.updateMany({
          where: {
            landingPageId: landingPage.id,
            tourId: item.tourId,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        }),
      ),
    );

    return this.findOneAdmin(landingPage.id);
  }

  // --- PUBLIC API METHODS ---

  async findAllPublic(query: {
    page?: number;
    limit?: number;
    type?: string;
    locale?: string;
  }) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const { type, locale = 'en' } = query;

    const where: Prisma.TourLandingPageWhereInput = {
      status: 'PUBLISHED',
      isActive: true,
      deletedAt: null,
    };
    if (type) where.type = type;

    const [total, items] = await Promise.all([
      this.prisma.tourLandingPage.count({ where }),
      this.prisma.tourLandingPage.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          tours: {
            where: {
              isVisible: true,
              tour: { isActive: true, status: 'PUBLISHED', deletedAt: null },
            },
            orderBy: { sortOrder: 'asc' },
            include: {
              tour: {
                include: {
                  images: { where: { isHero: true }, take: 1 },
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = items.map((lp) => ({
      id: lp.id,
      slug: lp.slug,
      type: lp.type,
      title: extractI18n(lp.titleJsonb, locale),
      subtitle: extractI18n(lp.subtitleJsonb, locale),
      description: extractI18n(lp.descriptionJsonb, locale),
      brief: extractI18n(lp.briefJsonb, locale),
      heroImageUrl: lp.heroImageUrl,
      heroVideoUrl: lp.heroVideoUrl,
      seoTitle: extractI18n(lp.seoTitleJsonb, locale),
      seoDescription: extractI18n(lp.seoDescriptionJsonb, locale),
      seoKeywords: extractI18n(lp.seoKeywordsJsonb, locale),
      sections: lp.sectionsJsonb,
      toursCount: lp.tours.length,
    }));

    return paginate(formatted, total, page, limit);
  }

  async findOnePublic(slug: string, locale = 'en') {
    const lp = await this.prisma.tourLandingPage.findFirst({
      where: {
        slug,
        status: 'PUBLISHED',
        isActive: true,
        deletedAt: null,
      },
      include: {
        tours: {
          where: {
            isVisible: true,
            tour: { isActive: true, status: 'PUBLISHED', deletedAt: null },
          },
          orderBy: { sortOrder: 'asc' },
          include: {
            tour: {
              include: {
                images: { orderBy: { sortOrder: 'asc' } },
                itineraries: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!lp) {
      throw new NotFoundException('Landing page not found');
    }

    return {
      id: lp.id,
      slug: lp.slug,
      type: lp.type,
      title: extractI18n(lp.titleJsonb, locale),
      subtitle: extractI18n(lp.subtitleJsonb, locale),
      description: extractI18n(lp.descriptionJsonb, locale),
      brief: extractI18n(lp.briefJsonb, locale),
      heroImageUrl: lp.heroImageUrl,
      heroVideoUrl: lp.heroVideoUrl,
      seoTitle: extractI18n(lp.seoTitleJsonb, locale),
      seoDescription: extractI18n(lp.seoDescriptionJsonb, locale),
      seoKeywords: extractI18n(lp.seoKeywordsJsonb, locale),
      sections: lp.sectionsJsonb,
      tours: lp.tours.map((t) => ({
        id: t.tour.id,
        slug: t.tour.slug,
        title: extractI18n(t.tour.titleJsonb, locale),
        overview: extractI18n(t.tour.overviewJsonb, locale),
        duration: t.tour.durationJsonb,
        basePriceUsd: t.tour.basePriceUsd,
        currency: t.tour.currency,
        country: t.tour.country,
        city: t.tour.city,
        category: t.tour.category,
        isFeatured: t.isFeatured || t.tour.isFeatured,
        customBadge: t.customBadge ? extractI18n(t.customBadge, locale) : null,
        heroImage:
          t.tour.images.find((img) => img.isHero)?.imageUrl ||
          t.tour.images[0]?.imageUrl ||
          null,
        images: t.tour.images.map((img) => img.imageUrl),
        sortOrder: t.sortOrder,
      })),
    };
  }

  private sanitizeLocalized(
    value: Record<string, string> | undefined,
    fieldName: string,
    maxLength: number,
    allowRichText = false,
    requireEnglish = false,
  ): Prisma.InputJsonValue {
    if (!value) return {};
    const entries = Object.entries(value);
    if (
      entries.length === 0 ||
      entries.length > SUPPORTED_LOCALES.length ||
      entries.some(
        ([locale, text]) =>
          !SUPPORTED_LOCALES.includes(locale) ||
          typeof text !== 'string' ||
          text.length > maxLength,
      )
    ) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    const sanitized = Object.fromEntries(
      entries.map(([locale, text]) => [
        locale,
        (allowRichText
          ? sanitizeHtmlContent(text)
          : sanitizePlainText(text)
        ).slice(0, maxLength),
      ]),
    );
    if (
      requireEnglish &&
      (typeof sanitized.en !== 'string' || !sanitized.en.trim())
    ) {
      throw new BadRequestException(`${fieldName}.en is required`);
    }
    return sanitized;
  }

  private sanitizeSections(value: unknown): Prisma.InputJsonValue {
    if (value === undefined || value === null) return {};
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new BadRequestException('Invalid sectionsJsonb');
    }
    if (Buffer.byteLength(serialized, 'utf8') > 100_000) {
      throw new BadRequestException('sectionsJsonb is too large');
    }
    return this.sanitizeSectionValue(value, 0) as Prisma.InputJsonValue;
  }

  private sanitizeSectionValue(
    value: unknown,
    depth: number,
  ): Prisma.InputJsonValue | null {
    if (depth > 5) {
      throw new BadRequestException('sectionsJsonb is too deeply nested');
    }
    if (typeof value === 'string') {
      return sanitizeHtmlContent(value).slice(0, 10_000);
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length > 100) {
        throw new BadRequestException('sectionsJsonb array is too large');
      }
      return value.map((item) =>
        this.sanitizeSectionValue(item, depth + 1),
      );
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (
        entries.length > 100 ||
        entries.some(([key]) =>
          ['__proto__', 'prototype', 'constructor'].includes(key),
        )
      ) {
        throw new BadRequestException('Invalid sectionsJsonb object');
      }
      return Object.fromEntries(
        entries.map(([key, item]) => [
          key,
          this.sanitizeSectionValue(item, depth + 1),
        ]),
      );
    }
    throw new BadRequestException('Invalid sectionsJsonb value');
  }
}
