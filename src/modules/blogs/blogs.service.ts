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
} from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate, slugify } from '../../common/utils';

@Injectable()
export class BlogsService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeJsonbContent(jsonb: any): any {
    if (!jsonb || typeof jsonb !== 'object') return jsonb;
    const result: Record<string, string> = {};
    for (const key of Object.keys(jsonb)) {
      if (typeof jsonb[key] === 'string') {
        result[key] = sanitizeHtmlContent(jsonb[key]);
      }
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
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    };

    if (category) where.category = category;
    if (tag) where.tags = { has: tag };
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
      throw new NotFoundException(`Blog article '${slug}' not found`);
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
    const article = await this.prisma.blogArticle.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deletedAt: null,
      },
    });

    if (!article) {
      throw new NotFoundException(`Blog article '${idOrSlug}' not found`);
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
      throw new ConflictException(
        `Blog article with slug '${targetSlug}' already exists.`,
      );
    }

    const sanitizedContent = this.sanitizeJsonbContent(dto.contentJsonb);
    const sanitizedExcerpt = dto.excerptJsonb
      ? this.sanitizeJsonbContent(dto.excerptJsonb)
      : undefined;

    const created = await this.prisma.blogArticle.create({
      data: {
        slug: targetSlug,
        titleJsonb: dto.titleJsonb as Prisma.InputJsonValue,
        contentJsonb: sanitizedContent as Prisma.InputJsonValue,
        excerptJsonb:
          (sanitizedExcerpt as Prisma.InputJsonValue) || Prisma.JsonNull,
        seoTitleJsonb:
          (dto.seoTitleJsonb as Prisma.InputJsonValue) || Prisma.JsonNull,
        seoDescriptionJsonb:
          (dto.seoDescriptionJsonb as Prisma.InputJsonValue) || Prisma.JsonNull,
        coverImage: dto.coverImage || null,
        author: dto.author || null,
        category: dto.category || null,
        tags: dto.tags || [],
        status: dto.status || (dto.isPublished ? 'PUBLISHED' : 'DRAFT'),
        isPublished: dto.isPublished ?? dto.status === 'PUBLISHED',
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

    let targetSlug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      targetSlug = slugify(dto.slug);
      const conflict = await this.prisma.blogArticle.findUnique({
        where: { slug: targetSlug },
      });
      if (conflict && conflict.id !== existing.id) {
        throw new ConflictException(
          `Blog article with slug '${targetSlug}' already exists.`,
        );
      }
    }

    const data: Prisma.BlogArticleUpdateInput = {
      ...(dto.slug && { slug: targetSlug }),
      ...(dto.titleJsonb && { titleJsonb: dto.titleJsonb }),
      ...(dto.contentJsonb && {
        contentJsonb: this.sanitizeJsonbContent(dto.contentJsonb),
      }),
      ...(dto.excerptJsonb !== undefined && {
        excerptJsonb: dto.excerptJsonb
          ? this.sanitizeJsonbContent(dto.excerptJsonb)
          : null,
      }),
      ...(dto.seoTitleJsonb !== undefined && {
        seoTitleJsonb: dto.seoTitleJsonb,
      }),
      ...(dto.seoDescriptionJsonb !== undefined && {
        seoDescriptionJsonb: dto.seoDescriptionJsonb,
      }),
      ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
      ...(dto.author !== undefined && { author: dto.author }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
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
}
