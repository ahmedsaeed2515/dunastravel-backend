import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminCmsService {
  private readonly logger = new Logger(AdminCmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listBlocks() {
    return this.prisma.cmsBlock.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getBlock(key: string) {
    const block = await this.prisma.cmsBlock.findUnique({ where: { key } });
    if (!block) throw new NotFoundException(`CMS block with key ${key} not found`);
    return block;
  }

  async updateBlock(key: string, content: any, adminUserId: string) {
    const block = await this.prisma.cmsBlock.upsert({
      where: { key },
      create: {
        key,
        content,
        lastUpdatedBy: adminUserId,
      },
      update: {
        content,
        lastUpdatedBy: adminUserId,
      },
    });

    this.logger.log(`CMS block ${key} updated by admin ${adminUserId}`);
    await this.cacheManager.del(`cms:${key}`);
    return block;
  }
}
