import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getSetting(key: string, defaultValue: any = null) {
    const cacheKey = `setting:${key}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      return defaultValue;
    }

    // Cache for 24 hours since settings rarely change
    await this.cacheManager.set(cacheKey, setting.value, 86400000);
    return setting.value;
  }

  async updateSetting(key: string, value: any) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    const cacheKey = `setting:${key}`;
    await this.cacheManager.set(cacheKey, setting.value, 86400000);

    return setting;
  }
}
