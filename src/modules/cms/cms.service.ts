import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { sanitizeHtmlContent } from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getPublicBlock(key: string) {
    const cacheKey = `cms:${key}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException(`CMS block '${key}' not found`);

    // Cache for 30 minutes
    await this.cacheManager.set(cacheKey, block, 1800000);
    return block;
  }

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 20,
    search?: string,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where: any = search
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
    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException(`CMS block '${key}' not found`);
    return block;
  }

  async upsertAdmin(key: string, content: unknown, lastUpdatedBy?: string) {
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new BadRequestException('CMS block key is required');
    }

    const sanitizedKey = key.trim();
    let sanitizedContent: unknown = content;

    if (typeof content === 'string') {
      sanitizedContent = sanitizeHtmlContent(content);
    } else if (typeof content === 'object' && content !== null) {
      const record = JSON.parse(JSON.stringify(content)) as Record<
        string,
        unknown
      >;
      for (const k of Object.keys(record)) {
        if (typeof record[k] === 'string') {
          record[k] = sanitizeHtmlContent(record[k] as string);
        }
      }
      sanitizedContent = record;
    }

    const block = await this.prisma.cmsBlock.upsert({
      where: { key: sanitizedKey },
      create: {
        key: sanitizedKey,
        content: sanitizedContent as Prisma.InputJsonValue,
        lastUpdatedBy: lastUpdatedBy || null,
      },
      update: {
        content: sanitizedContent as Prisma.InputJsonValue,
        lastUpdatedBy: lastUpdatedBy || null,
      },
    });

    const cacheKey = `cms:${sanitizedKey}`;
    await this.cacheManager.del(cacheKey);

    return block;
  }

  async deleteAdmin(key: string) {
    const existing = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`CMS block '${key}' not found`);
    }

    await this.prisma.cmsBlock.delete({ where: { key } });
    await this.cacheManager.del(`cms:${key}`);

    return { success: true, message: `CMS block '${key}' deleted.` };
  }
}
