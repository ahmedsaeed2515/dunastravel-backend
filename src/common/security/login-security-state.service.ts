import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const FAILURE_SCRIPT = `
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
if attempts >= tonumber(ARGV[1]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
`;

@Injectable()
export class LoginSecurityStateService implements OnApplicationShutdown {
  private readonly redis: Redis;
  private connectPromise?: Promise<void>;

  constructor(config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is required for authentication security');
    }
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
    this.redis.on('error', () => {});
  }

  async isLocked(ip: string, email: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return false;
    try {
      await this.ensureConnected();
      const keys = this.keys(ip, email);
      const locks = await this.redis.mget(keys.pairLock, keys.accountLock);
      return locks.some(Boolean);
    } catch {
      return false;
    }
  }

  async recordFailure(ip: string, email: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.ensureConnected();
      const keys = this.keys(ip, email);
      await Promise.all([
        this.recordCounter(keys.pairAttempts, keys.pairLock, 5),
        this.recordCounter(keys.accountAttempts, keys.accountLock, 25),
      ]);
    } catch {
      // Ignore security counter error when Redis is unreachable
    }
  }

  async clearFailures(ip: string, email: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.ensureConnected();
      const keys = this.keys(ip, email);
      await this.redis.del(keys.pairAttempts, keys.accountAttempts);
    } catch {
      // Ignore security counter clear error when Redis is unreachable
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }

  private async recordCounter(
    attemptsKey: string,
    lockKey: string,
    threshold: number,
  ): Promise<void> {
    await this.redis.eval(
      FAILURE_SCRIPT,
      2,
      attemptsKey,
      lockKey,
      threshold,
      5 * 60_000,
      15 * 60_000,
    );
  }

  private keys(ip: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const pair = this.digest(`${ip}:${normalizedEmail}`);
    const account = this.digest(normalizedEmail);
    return {
      pairAttempts: `security:login:pair:${pair}:attempts`,
      pairLock: `security:login:pair:${pair}:lock`,
      accountAttempts: `security:login:account:${account}:attempts`,
      accountLock: `security:login:account:${account}:lock`,
    };
  }

  private digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (this.redis.status === 'wait') {
      this.connectPromise ??= this.redis
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connectPromise = undefined;
        });
      await this.connectPromise;
    }
    if ((this.redis.status as string) !== 'ready') {
      throw new Error('Authentication security store is unavailable');
    }
  }
}
