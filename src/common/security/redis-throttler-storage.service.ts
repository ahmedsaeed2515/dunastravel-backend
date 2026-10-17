import { createHash } from 'crypto';
import Redis from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  return {tonumber(ARGV[2]) + 1, 0, 1, blockedTtl}
end

local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local hitTtl = redis.call('PTTL', KEYS[1])

if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, hitTtl, 1, tonumber(ARGV[3])}
end

return {hits, hitTtl, 0, 0}
`;

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: Redis;
  private connectPromise?: Promise<void>;
  private isOffline = false;
  private lastConnectAttempt = 0;
  private lastWarnLog = 0;
  private readonly memoryStore = new Map<
    string,
    { hits: number; resetAt: number }
  >();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    this.redis.on('error', () => {
      this.isOffline = true;
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.DISABLE_THROTTLER === 'true' ||
      process.env.THROTTLE_DISABLED === 'true'
    ) {
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1_000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    try {
      await this.ensureConnected();

      const digest = createHash('sha256')
        .update(`${throttlerName}:${key}`)
        .digest('hex');
      const prefix = `security:throttle:${digest}`;
      const effectiveBlockDuration = blockDuration > 0 ? blockDuration : ttl;
      const result = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        `${prefix}:hits`,
        `${prefix}:blocked`,
        ttl,
        limit,
        effectiveBlockDuration,
      )) as Array<number | string>;

      const [totalHits, ttlMs, blocked, blockTtlMs] = result.map(Number);
      this.isOffline = false;
      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil(ttlMs / 1_000)),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.max(0, Math.ceil(blockTtlMs / 1_000)),
      };
    } catch (error) {
      this.isOffline = true;
      const now = Date.now();
      if (now - this.lastWarnLog > 60_000) {
        this.lastWarnLog = now;
        console.warn(
          '[RedisThrottlerStorage] Redis rate-limit fallback engaged (throttled 60s):',
          (error as Error)?.message,
        );
      }

      // High-performance In-Memory Throttler Fallback
      const memKey = `${throttlerName}:${key}`;
      const record = this.memoryStore.get(memKey);
      if (!record || record.resetAt <= now) {
        this.memoryStore.set(memKey, { hits: 1, resetAt: now + ttl });
        if (this.memoryStore.size > 10_000) {
          const oldestKey = this.memoryStore.keys().next().value;
          if (oldestKey) this.memoryStore.delete(oldestKey);
        }
        return {
          totalHits: 1,
          timeToExpire: Math.ceil(ttl / 1_000),
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      }

      record.hits += 1;
      const isBlocked = record.hits > limit;
      const timeToExpire = Math.max(
        0,
        Math.ceil((record.resetAt - now) / 1_000),
      );
      return {
        totalHits: record.hits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire: isBlocked ? timeToExpire : 0,
      };
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
    } catch {
      // Ignore disconnect errors on shutdown
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (this.redis.status === 'connecting' && this.connectPromise) {
      await this.connectPromise;
      return;
    }

    const now = Date.now();
    if (this.isOffline && now - this.lastConnectAttempt < 15_000) {
      throw new Error('Security rate-limit store offline cooldown');
    }

    if (
      this.redis.status === 'wait' ||
      this.redis.status === 'end' ||
      this.redis.status === 'close'
    ) {
      this.lastConnectAttempt = now;
      this.connectPromise = this.redis
        .connect()
        .then(() => {
          this.isOffline = false;
        })
        .finally(() => {
          this.connectPromise = undefined;
        });
      await this.connectPromise;
    }
    if ((this.redis.status as string) !== 'ready') {
      this.isOffline = true;
      throw new Error('Security rate-limit store is unavailable');
    }
  }
}
