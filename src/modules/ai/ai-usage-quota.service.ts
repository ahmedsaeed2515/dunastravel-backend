import {
  HttpException,
  HttpStatus,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

const CONSUME_QUOTA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return current
`;

@Injectable()
export class AiUsageQuotaService implements OnApplicationShutdown {
  private readonly redis: Redis;
  private readonly dailyLimit: number;
  private connectPromise?: Promise<void>;

  constructor(config: ConfigService) {
    this.dailyLimit = config.get<number>('AI_DAILY_QUOTA_PER_ADMIN') ?? 100;
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
  }

  async consume(adminUserId: string): Promise<void> {
    await this.ensureConnected();
    const now = new Date();
    const tomorrowUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    );
    const ttlMs = Math.max(60_000, tomorrowUtc - now.getTime());
    const principal = createHash('sha256').update(adminUserId).digest('hex');
    const day = now.toISOString().slice(0, 10);
    const key = `security:ai-quota:${day}:${principal}`;
    const consumed = Number(
      await this.redis.eval(CONSUME_QUOTA_SCRIPT, 1, key, ttlMs),
    );

    if (!Number.isSafeInteger(consumed) || consumed > this.dailyLimit) {
      throw new HttpException(
        'Daily AI usage quota exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === 'ready') {
      await this.redis.quit();
    } else {
      this.redis.disconnect();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return;
    if (!this.connectPromise) {
      this.connectPromise = this.redis
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connectPromise = undefined;
        });
    }
    await this.connectPromise;
  }
}
