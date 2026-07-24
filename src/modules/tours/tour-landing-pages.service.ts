import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateTourLandingPageDto } from './dto/create-tour-landing-page.dto';
import { UpdateTourLandingPageDto } from './dto/update-tour-landing-page.dto';
import { AttachToursDto, UpdateTourRelationDto, ReorderToursDto } from './dto/attach-tours.dto';
import { extractI18n, getPaginationParams, paginate } from '../../common/utils';

const SUPPORTED_LOCALES = ['en', 'ar', 'es', 'pt', 'it'];

@Injectable()
export class TourLandingPagesService {
  private readonly logger = new Logger(TourLandingPagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private calculateLocaleCompletion(landingPage: any) {
    const completion: Record<string, { title: boolean; subtitle: boolean; description: boolean; isComplete: boolean }> = {};
    const titleObj = (landingPage.titleJsonb as Record<string, any>) || {};
    const subObj = (landingPage.subtitleJsonb as Record<string, any>) || {};
    const descObj = (landingPage.descriptionJsonb as Record<string, any>) || {};

    for (const locale of SUPPORTED_LOCALES) {
      const hasTitle = Boolean(titleObj[locale] && titleObj[locale].trim());
      const hasSub = Boolean(subObj[locale] && subObj[locale].trim());
      const hasDesc = Boolean(descObj[locale] && descObj[locale].trim());
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

  async findAllAdmin(query: any) {
    const { page, limit, skip } = getPaginationParams(query);
    const { search, status, type, isActive } = query;

    const where: any = {
      deletedAt: null,
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { titleJsonb: { path: ['en'], string_contains: search } },
        { titleJsonb: { path: ['ar'], string_contains: search } },
      ];
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
      const activeTours = lp.tours.filter((t) => t.tour.isActive && t.tour.status === 'PUBLISHED').length;

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
      throw new ConflictException(`Landing page with slug '${dto.slug}' already exists.`);
    }

    const created = await this.prisma.tourLandingPage.create({
      data: {
        slug: dto.slug,
        type: dto.type || 'DESTINATION',
        titleJsonb: dto.titleJsonb,
        subtitleJsonb: dto.subtitleJsonb || {},
        descriptionJsonb: dto.descriptionJsonb || {},
        briefJsonb: dto.briefJsonb || {},
        heroImageUrl: dto.heroImageUrl || null,
        heroVideoUrl: dto.heroVideoUrl || null,
        seoTitleJsonb: dto.seoTitleJsonb || {},
        seoDescriptionJsonb: dto.seoDescriptionJsonb || {},
        seoKeywordsJsonb: dto.seoKeywordsJsonb || {},
        sectionsJsonb: dto.sectionsJsonb || {},
        status: dto.status || 'PUBLISHED',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        sortOrder: dto.sortOrder || 0,
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
        throw new ConflictException(`Landing page with slug '${dto.slug}' already exists.`);
      }
    }

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.type && { type: dto.type }),
        ...(dto.titleJsonb && { titleJsonb: dto.titleJsonb }),
        ...(dto.subtitleJsonb && { subtitleJsonb: dto.subtitleJsonb }),
        ...(dto.descriptionJsonb && { descriptionJsonb: dto.descriptionJsonb }),
        ...(dto.briefJsonb && { briefJsonb: dto.briefJsonb }),
        ...(dto.heroImageUrl !== undefined && { heroImageUrl: dto.heroImageUrl }),
        ...(dto.heroVideoUrl !== undefined && { heroVideoUrl: dto.heroVideoUrl }),
        ...(dto.seoTitleJsonb && { seoTitleJsonb: dto.seoTitleJsonb }),
        ...(dto.seoDescriptionJsonb && { seoDescriptionJsonb: dto.seoDescriptionJsonb }),
        ...(dto.seoKeywordsJsonb && { seoKeywordsJsonb: dto.seoKeywordsJsonb }),
        ...(dto.sectionsJsonb && { sectionsJsonb: dto.sectionsJsonb }),
        ...(dto.status && { status: dto.status }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    return this.findOneAdmin(existing.id);
  }

  async setStatusAdmin(idOrSlug: string, status: string, isActive?: boolean) {
    const existing = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        status,
        ...(isActive !== undefined && { isActive }),
      },
    });

    return this.findOneAdmin(existing.id);
  }

  async softDeleteAdmin(idOrSlug: string) {
    const existing = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPage.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { success: true, message: `Landing page '${existing.slug}' deleted.` };
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
    if (!landingPage) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    const highestOrder = await this.prisma.tourLandingPageTour.aggregate({
      where: { landingPageId: landingPage.id },
      _max: { sortOrder: true },
    });

    let currentOrder = (highestOrder._max.sortOrder || 0) + 1;

    for (const tourId of dto.tourIds) {
      // Check if tour exists
      const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
      if (!tour) continue;

      await this.prisma.tourLandingPageTour.upsert({
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
          isFeatured: dto.isFeatured || false,
          isVisible: dto.isVisible !== undefined ? dto.isVisible : true,
          customBadge: dto.customBadge || Prisma.JsonNull,
        },
        update: {
          isVisible: dto.isVisible !== undefined ? dto.isVisible : true,
          ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        },
      });
    }

    return this.findOneAdmin(landingPage.id);
  }

  async detachTour(idOrSlug: string, tourId: string) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    await this.prisma.tourLandingPageTour.deleteMany({
      where: {
        landingPageId: landingPage.id,
        tourId,
      },
    });

    return { success: true, message: `Tour '${tourId}' detached from interface '${landingPage.slug}'. Global tour remains intact.` };
  }

  async updateTourRelation(idOrSlug: string, tourId: string, dto: UpdateTourRelationDto) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

    const relation = await this.prisma.tourLandingPageTour.findUnique({
      where: { landingPageId_tourId: { landingPageId: landingPage.id, tourId } },
    });
    if (!relation) throw new NotFoundException(`Relation not found.`);

    await this.prisma.tourLandingPageTour.update({
      where: { id: relation.id },
      data: {
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.customBadge !== undefined && { customBadge: dto.customBadge }),
      },
    });

    return this.findOneAdmin(landingPage.id);
  }

  async reorderToursInInterface(idOrSlug: string, dto: ReorderToursDto) {
    const landingPage = await this.prisma.tourLandingPage.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deletedAt: null },
    });
    if (!landingPage) throw new NotFoundException(`Landing page '${idOrSlug}' not found.`);

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

  async findAllPublic(query: any) {
    const { page, limit, skip } = getPaginationParams(query);
    const { type, locale = 'en' } = query;

    const where: any = {
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
            where: { isVisible: true, tour: { isActive: true, status: 'PUBLISHED', deletedAt: null } },
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
          where: { isVisible: true, tour: { isActive: true, status: 'PUBLISHED', deletedAt: null } },
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
      throw new NotFoundException(`Landing page '${slug}' not found or not published.`);
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
        heroImage: t.tour.images.find((img) => img.isHero)?.imageUrl || t.tour.images[0]?.imageUrl || null,
        images: t.tour.images.map((img) => img.imageUrl),
        sortOrder: t.sortOrder,
      })),
    };
  }
}
