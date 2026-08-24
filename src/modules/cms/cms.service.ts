import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CmsBlockStatus, Prisma } from '@prisma/client';
import { sanitizeHtmlContent } from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';
import { AuthenticatedUser } from '../../common/types';
import { randomUUID } from 'crypto';
import { CmsLocale, getCmsBlockDefinition, isCmsLocale } from './cms.registry';
import { UpsertCmsBlockDto } from './dto/cms.dto';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getPublicBlock(key: string, lang?: CmsLocale) {
    this.assertValidKey(key);
    const definition = getCmsBlockDefinition(key);
    if (!definition?.public) throw new NotFoundException('CMS block not found');
    const locale = isCmsLocale(lang) ? lang : undefined;
    const cacheKey = `cms:${key}:${locale ?? 'raw'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException('CMS block not found');

    if (block.status !== CmsBlockStatus.PUBLISHED) {
      throw new NotFoundException('CMS block not found');
    }

    // Cache for 30 minutes
    const content = this.localizePublicContent(block.content, locale);
    const response = { ...block, content: content.content, locale: locale ?? null, translationStatus: content.translationStatus };
    await this.cacheManager.set(cacheKey, response, 1800000);
    return response;
  }

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 20,
    search?: string,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.CmsBlockWhereInput = search
      ? { key: { contains: search, mode: 'insensitive' } }
      : {};

    const [total, records] = await Promise.all([
      this.prisma.cmsBlock.count({ where }),
      this.prisma.cmsBlock.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOneAdmin(key: string) {
    this.assertValidKey(key);
    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException('CMS block not found');
    return block;
  }

  async upsertAdmin(key: string, dto: UpsertCmsBlockDto, actor: AuthenticatedUser) {
    this.assertValidKey(key);
    const sanitizedKey = key.trim();
    const content = dto.content;
    const serialized = JSON.stringify(content);
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > 100_000) {
      throw new BadRequestException('CMS content exceeds the size limit');
    }
    const sanitizedContent = this.sanitizeContent(content, 0);

    const block = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cmsBlock.findUnique({ where: { key: sanitizedKey } });
      if (existing && dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
        throw new ConflictException('CMS block has changed; reload before saving');
      }
      const saved = await tx.cmsBlock.upsert({
        where: { key: sanitizedKey },
        create: { key: sanitizedKey, content: sanitizedContent as Prisma.InputJsonValue, status: dto.status ?? CmsBlockStatus.DRAFT, version: 1, lastUpdatedBy: actor?.id || 'system-admin' },
        update: { content: sanitizedContent as Prisma.InputJsonValue, status: dto.status ?? existing!.status, version: { increment: 1 }, lastUpdatedBy: actor?.id || 'system-admin' },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor?.id || 'system-admin',
          actorRole: actor?.role || 'ADMIN',
          action: 'CMS_BLOCK_UPSERTED',
          entityType: 'CMS_BLOCK',
          entityId: sanitizedKey,
          metadata: {
            contentBytes: Buffer.byteLength(serialized, 'utf8'),
            status: saved.status,
            version: saved.version,
          },
        },
      });
      return saved;
    });

    await this.clearPublicCache(sanitizedKey);

    return block;
  }

  async deleteAdmin(key: string, actor: AuthenticatedUser) {
    this.assertValidKey(key);
    const existing = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException('CMS block not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cmsBlock.delete({ where: { key } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'CMS_BLOCK_DELETED',
          entityType: 'CMS_BLOCK',
          entityId: key,
        },
      });
    });
    await this.clearPublicCache(key);

    return { success: true, message: `CMS block '${key}' deleted.` };
  }

  async createCatalogItem(
    key: string,
    item: Record<string, unknown>,
    actor: AuthenticatedUser,
  ) {
    const itemId = randomUUID();
    return this.mutateCatalog(key, itemId, actor, 'create', item);
  }

  async updateCatalogItem(
    key: string,
    itemId: string,
    item: Record<string, unknown>,
    actor: AuthenticatedUser,
  ) {
    return this.mutateCatalog(key, itemId, actor, 'update', item);
  }

  async deleteCatalogItem(
    key: string,
    itemId: string,
    actor: AuthenticatedUser,
  ) {
    await this.mutateCatalog(key, itemId, actor, 'delete');
    return { success: true };
  }

  private async mutateCatalog(
    key: string,
    itemId: string,
    actor: AuthenticatedUser,
    operation: 'create' | 'update' | 'delete',
    item?: Record<string, unknown>,
  ) {
    this.assertManagedCatalogKey(key);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(itemId)) {
      throw new BadRequestException('Invalid catalog item id');
    }

    const sanitizedItem = item
      ? (this.sanitizeContent({ ...item, id: itemId }, 0) as Record<
          string,
          unknown
        >)
      : undefined;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.cmsBlock.findUnique({ where: { key } });
        const catalog = existing?.content;
        if (catalog !== undefined && !Array.isArray(catalog)) {
          throw new BadRequestException('CMS catalog content must be an array');
        }
        const items =
          (catalog as Array<Record<string, unknown>> | undefined) ?? [];
        const index = items.findIndex((entry) => entry?.id === itemId);

        if (operation !== 'create' && index < 0) {
          throw new NotFoundException('Catalog item not found');
        }

        let next: Array<Record<string, unknown>>;
        if (operation === 'create') {
          next = [sanitizedItem!, ...items];
        } else if (operation === 'update') {
          next = items.map((entry, entryIndex) =>
            entryIndex === index
              ? { ...entry, ...sanitizedItem, id: itemId }
              : entry,
          );
        } else {
          next = items.filter((_, entryIndex) => entryIndex !== index);
        }

        const serialized = JSON.stringify(next);
        if (Buffer.byteLength(serialized, 'utf8') > 100_000) {
          throw new BadRequestException('CMS content exceeds the size limit');
        }

        await tx.cmsBlock.upsert({
          where: { key },
          create: {
            key,
            content: next as Prisma.InputJsonValue,
            lastUpdatedBy: actor.id,
          },
          update: {
            content: next as Prisma.InputJsonValue,
            lastUpdatedBy: actor.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: `CMS_CATALOG_ITEM_${operation.toUpperCase()}D`,
            entityType: 'CMS_CATALOG_ITEM',
            entityId: itemId,
            metadata: { key },
          },
        });
        return sanitizedItem;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.clearPublicCache(key);
    return result;
  }

  private assertManagedCatalogKey(key: string): void {
    this.assertValidKey(key);
    if (getCmsBlockDefinition(key)?.kind !== 'catalog') {
      throw new BadRequestException('CMS block is not a managed catalog');
    }
  }

  private assertValidKey(key: string): void {
    if (
      typeof key !== 'string' ||
      !/^[a-z][a-z0-9_.-]{0,99}$/.test(key) ||
      !getCmsBlockDefinition(key)
    ) {
      throw new BadRequestException('Invalid CMS block key');
    }
  }

  private sanitizeContent(value: unknown, depth: number): unknown {
    if (depth > 5) {
      throw new BadRequestException('CMS content is nested too deeply');
    }
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new BadRequestException('CMS content contains an invalid number');
      }
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > 20_000) {
        throw new BadRequestException('CMS text exceeds the size limit');
      }
      return sanitizeHtmlContent(value);
    }
    if (Array.isArray(value)) {
      if (value.length > 100) {
        throw new BadRequestException('CMS array exceeds the item limit');
      }
      return value.map((item) => this.sanitizeContent(item, depth + 1));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 100) {
        throw new BadRequestException('CMS object exceeds the key limit');
      }
      const result: Record<string, unknown> = {};
      for (const [key, child] of entries) {
        if (
          !/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key) ||
          ['__proto__', 'prototype', 'constructor'].includes(key)
        ) {
          throw new BadRequestException('CMS content contains an invalid key');
        }
        result[key] = this.sanitizeContent(child, depth + 1);
      }
      return result;
    }
    throw new BadRequestException('CMS content contains an unsupported value');
  }

  private localizePublicContent(content: unknown, locale?: CmsLocale): { content: unknown; translationStatus: 'NOT_LOCALIZED' | 'PRESENT' | 'MISSING' } {
    if (!locale || !content || typeof content !== 'object' || Array.isArray(content)) {
      return { content, translationStatus: 'NOT_LOCALIZED' };
    }
    const object = content as Record<string, unknown>;
    const hasLocaleShape = ['en', 'ar', 'es', 'pt', 'it'].some((candidate) => Object.prototype.hasOwnProperty.call(object, candidate));
    if (!hasLocaleShape) return { content, translationStatus: 'NOT_LOCALIZED' };
    if (!Object.prototype.hasOwnProperty.call(object, locale)) {
      return { content: null, translationStatus: 'MISSING' };
    }
    return { content: object[locale], translationStatus: 'PRESENT' };
  }

  private async clearPublicCache(key: string): Promise<void> {
    await Promise.all([undefined, 'en', 'ar', 'es', 'pt', 'it'].map((locale) => this.cacheManager.del(`cms:${key}:${locale ?? 'raw'}`)));
  }
}
