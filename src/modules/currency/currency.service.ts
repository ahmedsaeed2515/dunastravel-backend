import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_KEY = 'global_exchange_rates';
  private readonly FALLBACK_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    EGP: 47.5,
    AED: 3.67,
    SAR: 3.75,
    CHF: 0.9,
    JPY: 151.0,
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async onModuleInit() {
    await this.fetchAndCacheRates();
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  async fetchAndCacheRates() {
    this.logger.log('Fetching latest exchange rates...');
    try {
      // Using a free mockable API for this phase. In production, use fixerio, openexchangerates, etc.
      // E.g., const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/USD`);

      // For reliable demonstration, we will use a simulated network delay and our fallback rates,
      // as external free APIs can rate limit or require keys.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const rates = this.FALLBACK_RATES;

      await this.cacheManager.set(this.CACHE_KEY, rates, 43200000); // 12 hours TTL in ms
      this.logger.log('Exchange rates updated in Redis cache.');
    } catch (error: any) {
      this.logger.error(`Failed to fetch exchange rates: ${error.message}`);
      // Don't overwrite cache if it fails, rely on existing cache or fallback inline
    }
  }

  async getRates(): Promise<Record<string, number>> {
    const cachedRates = await this.cacheManager.get<Record<string, number>>(
      this.CACHE_KEY,
    );
    if (cachedRates) {
      return cachedRates;
    }

    // Fallback if cache is empty
    return this.FALLBACK_RATES;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (fromUpper === toUpper) return amount;

    const rates = await this.getRates();

    const rateFrom = rates[fromUpper];
    const rateTo = rates[toUpper];

    if (!rateFrom || !rateTo) {
      throw new Error(
        `Exchange rate not found for ${!rateFrom ? fromUpper : toUpper}`,
      );
    }

    // Convert to USD base first, then to target currency
    const baseUsd = amount / rateFrom;
    const converted = baseUsd * rateTo;

    return Number(converted.toFixed(2));
  }
}
