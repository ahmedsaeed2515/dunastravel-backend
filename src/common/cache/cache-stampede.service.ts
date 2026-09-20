import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CacheStampedeService {
  private readonly logger = new Logger(CacheStampedeService.name);
  private readonly inFlight = new Map<string, Promise<any>>();

  /**
   * Coalesces concurrent calls for the exact same key into a single execution.
   * If N concurrent requests arrive for an expired or missing cache entry,
   * exactly 1 database query executes, and all N callers await that single promise.
   */
  async singleFlight<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  getInFlightCount(): number {
    return this.inFlight.size;
  }
}
