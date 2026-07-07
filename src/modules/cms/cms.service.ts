import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

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
    if (!block) throw new NotFoundException('Content not found');

    // Cache for 30 minutes
    await this.cacheManager.set(cacheKey, block, 1800000);
    return block;
  }
}
