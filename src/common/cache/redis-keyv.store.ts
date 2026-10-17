import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { KeyvStoreAdapter, StoredData } from 'keyv';

interface MemoryCacheEntry {
  value: string;
  expires: number;
}

export class RedisKeyvStore extends EventEmitter implements KeyvStoreAdapter {
  readonly opts: { dialect: string; url: string };
  namespace?: string;
  private readonly redis: Redis;
  private readonly memoryStore = new Map<string, MemoryCacheEntry>();
  private readonly maxMemoryKeys = 5000;
  private isRedisConnected = false;

  constructor(redisUrl: string) {
    super();
    // Register default no-op error listener to prevent Node.js Unhandled 'error' event process crashes
    this.on('error', () => {});
    this.opts = { dialect: 'redis', url: redisUrl };
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });

    this.redis.on('connect', () => {
      this.isRedisConnected = true;
    });

    this.redis.on('ready', () => {
      this.isRedisConnected = true;
    });

    this.redis.on('close', () => {
      this.isRedisConnected = false;
    });

    this.redis.on('error', () => {
      this.isRedisConnected = false;
      // Intentionally handle error on underlying Redis client to prevent unhandled error crashes when Redis is offline
    });
  }

  async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    if (this.isRedisConnected) {
      try {
        const value = await this.redis.get(key);
        if (value !== null && value !== undefined) {
          return value as StoredData<Value>;
        }
      } catch {
        // Fall back to memoryStore below
      }
    }

    // Check local in-memory fallback
    const mem = this.memoryStore.get(key);
    if (mem) {
      if (mem.expires > 0 && mem.expires < Date.now()) {
        this.memoryStore.delete(key);
        return undefined;
      }
      return mem.value as StoredData<Value>;
    }

    return undefined;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    const effectiveTtl = ttl && ttl > 0 ? (ttl < 1000 ? ttl * 1000 : ttl) : 0;
    const expires = effectiveTtl > 0 ? Date.now() + effectiveTtl : 0;

    // Always maintain local in-memory cache to guarantee zero-drop resilience
    if (this.memoryStore.size >= this.maxMemoryKeys) {
      // LRU/FIFO eviction: drop oldest 10%
      let evicted = 0;
      for (const k of this.memoryStore.keys()) {
        this.memoryStore.delete(k);
        if (++evicted >= 500) break;
      }
    }
    this.memoryStore.set(key, { value: serialized, expires });

    if (this.isRedisConnected) {
      try {
        if (effectiveTtl > 0) {
          await this.redis.set(key, serialized, 'PX', effectiveTtl);
        } else {
          await this.redis.set(key, serialized);
        }
      } catch {
        // Ignore write errors when Redis is disconnected
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    const deletedMemory = this.memoryStore.delete(key);
    if (this.isRedisConnected) {
      try {
        const deletedRedis = (await this.redis.del(key)) > 0;
        return deletedRedis || deletedMemory;
      } catch {
        return deletedMemory;
      }
    }
    return deletedMemory;
  }

  async clear(): Promise<void> {
    this.memoryStore.clear();
    if (this.isRedisConnected) {
      try {
        const match = `${this.namespace || 'dunas-cache'}:*`;
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            match,
            'COUNT',
            100,
          );
          cursor = nextCursor;
          if (keys.length) {
            await this.redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch {
        // Ignore clear errors when Redis is unavailable
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }
}
