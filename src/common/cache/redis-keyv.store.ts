import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { KeyvStoreAdapter, StoredData } from 'keyv';

export class RedisKeyvStore
  extends EventEmitter
  implements KeyvStoreAdapter
{
  readonly opts: { dialect: string; url: string };
  namespace?: string;
  private readonly redis: Redis;

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
    this.redis.on('error', () => {
      // Intentionally handle error on underlying Redis client to prevent unhandled error crashes when Redis is offline
    });
  }

  async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
    try {
      const value = await this.redis.get(key);
      return (value ?? undefined) as StoredData<Value> | undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl && ttl > 0) {
        await this.redis.set(key, serialized, 'PX', ttl);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch {
      // Ignore cache write errors when Redis is unavailable
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      return (await this.redis.del(key)) > 0;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
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

  async disconnect(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }
}
