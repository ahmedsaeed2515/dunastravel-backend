import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateBlogArticleDto } from './dto/create-blog-article.dto';
import { UpdateBlogArticleDto } from './dto/update-blog-article.dto';
import { ListBlogsQueryDto } from './dto/list-blogs-query.dto';
import {
  extractI18nFallback,
  sanitizeHtmlContent,
  sanitizePlainText,
} from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate, slugify } from '../../common/utils';

@Injectable()
export class BlogsService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeLocalizedContent(
    jsonb: Record<string, string>,
    maxLength: number,
    richText: boolean,
    requireEnglish: boolean,
  ): Record<string, string> {
    if (!jsonb || typeof jsonb !== 'object' || Array.isArray(jsonb)) {
      throw new BadRequestException('Invalid localized content');
    }
    const supportedLocales = new Set(['en', 'ar', 'es', 'pt', 'it']);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(jsonb)) {
      if (
        !supportedLocales.has(key) ||
        typeof value !== 'string' ||
        value.length > maxLength
      ) {
        throw new BadRequestException('Invalid localized content');
      }
      result[key] = richText
        ? sanitizeHtmlContent(value)
        : sanitizePlainText(value);
    }
    if (
      requireEnglish &&
      (!result.en || result.en.trim().length === 0)
    ) {
      throw new BadRequestException('English localized content is required');
    }
    return result;
  }

  // --- PUBLIC API ---

  async findAllPublic(query: ListBlogsQueryDto) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const { search, category, tag, locale = 'en' } = query;
    const now = new Date();

    const where: Prisma.BlogArticleWhereInput = {
      deletedAt: null,
      isPublished: true,
      AND: [
        {
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
      ],
    };

    if (category) where.category = category;
    if (tag) where.tags = { has: tag };
    if (search) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { slug: { contains: search, mode: 'insensitive' } },
            { author: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.blogArticle.count({ where }),
      this.prisma.blogArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const formatted = items.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: extractI18nFallback(article.titleJsonb, locale),
      excerpt: article.excerptJsonb
        ? extractI18nFallback(article.excerptJsonb, locale)
        : '',
      content: extractI18nFallback(article.contentJsonb, locale),
      seoTitle: article.seoTitleJsonb
        ? extractI18nFallback(article.seoTitleJsonb, locale)
        : null,
      seoDescription: article.seoDescriptionJsonb
        ? extractI18nFallback(article.seoDescriptionJsonb, locale)
        : null,
      coverImage: article.coverImage,
      author: article.author,
      category: article.category,
      tags: article.tags,
      publishedAt: article.publishedAt || article.createdAt,
    }));

    return paginate(formatted, total, page, limit);
  }

  async findOnePublic(slug: string, locale = 'en') {
    this.assertSlugOrId(slug, false);
    if (!['en', 'ar', 'es', 'pt', 'it'].includes(locale)) {
      throw new BadRequestException('Unsupported locale');
    }
    const now = new Date();
    const article = await this.prisma.blogArticle.findFirst({
      where: {
        slug,
        deletedAt: null,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
    });

    if (!article) {
      throw new NotFoundException('Blog article not found');
    }

    return {
      id: article.id,
      slug: article.slug,
      title: extractI18nFallback(article.titleJsonb, locale),
      excerpt: article.excerptJsonb
        ? extractI18nFallback(article.excerptJsonb, locale)
        : '',
      content: extractI18nFallback(article.contentJsonb, locale),
      seoTitle: article.seoTitleJsonb
        ? extractI18nFallback(article.seoTitleJsonb, locale)
        : null,
      seoDescription: article.seoDescriptionJsonb
        ? extractI18nFallback(article.seoDescriptionJsonb, locale)
        : null,
      coverImage: article.coverImage,
      author: article.author,
      category: article.category,
      tags: article.tags,
      publishedAt: article.publishedAt || article.createdAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  async getCategoriesPublic() {
    const categories = await this.prisma.blogArticle.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });
    return categories
      .map((c) => c.category)
      .filter((c): c is string => Boolean(c));
  }

  async getTagsPublic() {
    const articles = await this.prisma.blogArticle.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
      },
      select: { tags: true },
    });
    const tagSet = new Set<string>();
    articles.forEach((a) => a.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }

  // --- ADMIN API ---

  async findAllAdmin(query: ListBlogsQueryDto) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const { search, category, status } = query;

    const where: Prisma.BlogArticleWhereInput = {
      deletedAt: null,
    };

    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.blogArticle.count({ where }),
      this.prisma.blogArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOneAdmin(idOrSlug: string) {
    this.assertSlugOrId(idOrSlug, true);
    const article = await this.prisma.blogArticle.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
    });

    if (!article) {
      throw new NotFoundException('Blog article not found');
    }

    return article;
  }

  async createAdmin(dto: CreateBlogArticleDto, actorId?: string) {
    const targetSlug = dto.slug
      ? slugify(dto.slug)
      : slugify(dto.titleJsonb?.en || 'article');
    const existing = await this.prisma.blogArticle.findUnique({
      where: { slug: targetSlug },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException('Blog article slug already exists');
    }

    this.assertPublicationState(dto.status, dto.isPublished);
    const effectiveStatus =
      dto.status || (dto.isPublished ? 'PUBLISHED' : 'DRAFT');
    const sanitizedTitle = this.sanitizeLocalizedContent(
      dto.titleJsonb,
      300,
      false,
      true,
    );
    const sanitizedContent = this.sanitizeLocalizedContent(
      dto.contentJsonb,
      100_000,
      true,
      true,
    );
    const sanitizedExcerpt = dto.excerptJsonb
      ? this.sanitizeLocalizedContent(
          dto.excerptJsonb,
          2_000,
          true,
          false,
        )
      : undefined;
    const sanitizedSeoTitle = dto.seoTitleJsonb
      ? this.sanitizeLocalizedContent(
          dto.seoTitleJsonb,
          300,
          false,
          false,
        )
      : undefined;
    const sanitizedSeoDescription = dto.seoDescriptionJsonb
      ? this.sanitizeLocalizedContent(
          dto.seoDescriptionJsonb,
          1_000,
          false,
          false,
        )
      : undefined;

    const created = await this.prisma.blogArticle.create({
      data: {
        slug: targetSlug,
        titleJsonb: sanitizedTitle as Prisma.InputJsonValue,
        contentJsonb: sanitizedContent as Prisma.InputJsonValue,
        excerptJsonb:
          (sanitizedExcerpt as Prisma.InputJsonValue) || Prisma.JsonNull,
        seoTitleJsonb:
          (sanitizedSeoTitle as Prisma.InputJsonValue) || Prisma.JsonNull,
        seoDescriptionJsonb:
          (sanitizedSeoDescription as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        coverImage: this.validateCoverImage(dto.coverImage),
        author: sanitizePlainText(dto.author).slice(0, 100) || null,
        category: sanitizePlainText(dto.category).slice(0, 100) || null,
        tags: (dto.tags || []).map((tag) =>
          sanitizePlainText(tag).slice(0, 50),
        ),
        status: effectiveStatus,
        isPublished: effectiveStatus === 'PUBLISHED',
        publishedAt: dto.publishedAt
          ? new Date(dto.publishedAt)
          : dto.isPublished
            ? new Date()
            : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'BLOG_ARTICLE_CREATED',
        entityType: 'BLOG_ARTICLE',
        entityId: created.id,
        metadata: { slug: created.slug },
      },
    });

    return created;
  }

  async updateAdmin(
    idOrSlug: string,
    dto: UpdateBlogArticleDto,
    actorId?: string,
  ) {
    const existing = await this.findOneAdmin(idOrSlug);
    this.assertPublicationState(dto.status, dto.isPublished);

    let targetSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      targetSlug = slugify(dto.slug);
      const conflict = await this.prisma.blogArticle.findUnique({
        where: { slug: targetSlug },
      });
      if (conflict && conflict.id !== existing.id) {
        throw new ConflictException('Blog article slug already exists');
      }
    }

    const data: Prisma.BlogArticleUpdateInput = {
      ...(dto.slug && { slug: targetSlug }),
      ...(dto.titleJsonb && {
        titleJsonb: this.sanitizeLocalizedContent(
          dto.titleJsonb,
          300,
          false,
          true,
        ),
      }),
      ...(dto.contentJsonb && {
        contentJsonb: this.sanitizeLocalizedContent(
          dto.contentJsonb,
          100_000,
          true,
          true,
        ),
      }),
      ...(dto.excerptJsonb !== undefined && {
        excerptJsonb: dto.excerptJsonb
          ? this.sanitizeLocalizedContent(
              dto.excerptJsonb,
              2_000,
              true,
              false,
            )
          : Prisma.JsonNull,
      }),
      ...(dto.seoTitleJsonb !== undefined && {
        seoTitleJsonb: dto.seoTitleJsonb
          ? this.sanitizeLocalizedContent(
              dto.seoTitleJsonb,
              300,
              false,
              false,
            )
          : Prisma.JsonNull,
      }),
      ...(dto.seoDescriptionJsonb !== undefined && {
        seoDescriptionJsonb: dto.seoDescriptionJsonb
          ? this.sanitizeLocalizedContent(
              dto.seoDescriptionJsonb,
              1_000,
              false,
              false,
            )
          : Prisma.JsonNull,
      }),
      ...(dto.coverImage !== undefined && {
        coverImage: this.validateCoverImage(dto.coverImage),
      }),
      ...(dto.author !== undefined && {
        author: sanitizePlainText(dto.author).slice(0, 100) || null,
      }),
      ...(dto.category !== undefined && {
        category: sanitizePlainText(dto.category).slice(0, 100) || null,
      }),
      ...(dto.tags !== undefined && {
        tags: dto.tags.map((tag) =>
          sanitizePlainText(tag).slice(0, 50),
        ),
      }),
      ...(dto.status && {
        status: dto.status,
        isPublished: dto.status === 'PUBLISHED',
      }),
      ...(dto.isPublished !== undefined && {
        isPublished: dto.isPublished,
        status: dto.isPublished ? 'PUBLISHED' : 'DRAFT',
      }),
      ...(dto.publishedAt !== undefined && {
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      }),
    };

    const updated = await this.prisma.blogArticle.update({
      where: { id: existing.id },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'BLOG_ARTICLE_UPDATED',
        entityType: 'BLOG_ARTICLE',
        entityId: updated.id,
        metadata: { slug: updated.slug },
      },
    });

    return updated;
  }

  async softDeleteAdmin(idOrSlug: string, actorId?: string) {
    const existing = await this.findOneAdmin(idOrSlug);

    await this.prisma.blogArticle.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        isPublished: false,
        status: 'ARCHIVED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'BLOG_ARTICLE_DELETED',
        entityType: 'BLOG_ARTICLE',
        entityId: existing.id,
        metadata: { slug: existing.slug },
      },
    });

    return {
      success: true,
      message: `Blog article '${existing.slug}' deleted.`,
    };
  }

  private assertPublicationState(
    status?: string,
    isPublished?: boolean,
  ): void {
    if (
      status &&
      isPublished !== undefined &&
      (status === 'PUBLISHED') !== isPublished
    ) {
      throw new BadRequestException(
        'Blog publication fields are inconsistent',
      );
    }
  }

  private assertSlugOrId(value: string, allowUuid: boolean): void {
    const isSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
    const isUuid =
      allowUuid &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    if (value.length > 150 || (!isSlug && !isUuid)) {
      throw new BadRequestException('Invalid blog identifier');
    }
  }

  private validateCoverImage(value?: string): string | null {
    if (!value) return null;
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com'
    ) {
      throw new BadRequestException(
        'Blog cover image must use approved media storage',
      );
    }
    return url.toString();
  }
}
