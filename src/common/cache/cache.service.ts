import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheStampedeService } from './cache-stampede.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private hits = 0;
  private misses = 0;
  private dbQueriesSpared = 0;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly stampedeService: CacheStampedeService,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.cacheManager.get<T>(key);
      if (val !== undefined && val !== null) {
        this.hits++;
        return val;
      }
      this.misses++;
      return null;
    } catch (err) {
      this.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs ?? 300_000);
    } catch (err) {
      this.logger.warn(`Cache set failed for key ${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (err) {
      this.logger.warn(`Cache del failed for key ${key}: ${(err as Error).message}`);
    }
  }

  /**
   * High-efficiency single-flight cached getOrSet with stampede protection.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 300_000,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    return this.stampedeService.singleFlight(key, async () => {
      // Double-check cache inside singleFlight guard
      const doubleCheck = await this.get<T>(key);
      if (doubleCheck !== null) {
        return doubleCheck;
      }

      const fresh = await fetcher();
      if (fresh !== undefined && fresh !== null) {
        await this.set(key, fresh, ttlMs);
        this.dbQueriesSpared++;
      }
      return fresh;
    });
  }

  getMetrics() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: `${hitRate.toFixed(2)}%`,
      dbQueriesSpared: this.dbQueriesSpared,
      inFlightStampedes: this.stampedeService.getInFlightCount(),
    };
  }

  resetMetrics() {
    this.hits = 0;
    this.misses = 0;
    this.dbQueriesSpared = 0;
  }
}
