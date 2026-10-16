import {
  Injectable,
  Logger,
  Inject,
  Optional,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { FrankfurterProvider } from './providers/frankfurter.provider';

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'BRL',
  'EGP',
  'SAR',
  'AED',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyRateInfo {
  code: string;
  rateToBase: string;
  lastUpdated: string;
  provider: string;
  isStale: boolean;
}

export interface CurrencyMetaInfo {
  ecbEurUsdRate: string;
  ecbUsdEurRate: string;
  source: string;
  provider: string;
  rateDate: string;
  isStale: boolean;
  status: 'fresh' | 'stale' | 'fallback';
  lastUpdated: string;
}

export interface GetRatesResponse {
  base: string;
  rates: Record<string, string>;
  details: CurrencyRateInfo[];
  timestamp: string;
  meta: CurrencyMetaInfo;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_KEY = 'global_exchange_rates_v2';
  private readonly STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly WEEKEND_STALENESS_MS = 72 * 60 * 60 * 1000; // 72 hours for weekend tolerance

  // Authoritative fallback values if DB and external provider are unavailable
  private readonly SAFE_FALLBACK_EUR_RATE = '0.888650'; // 1 USD = 0.888650 EUR
  private readonly SAFE_FALLBACK_EUR_USD = '1.125300'; // 1 EUR = 1.125300 USD

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Optional() private readonly frankfurterProvider?: FrankfurterProvider,
  ) {}

  isSupported(code: string): boolean {
    return SUPPORTED_CURRENCIES.includes(
      code.toUpperCase() as SupportedCurrency,
    );
  }

  private isDateStale(lastUpdatedMs: number, nowMs: number): boolean {
    const age = nowMs - lastUpdatedMs;
    const nowDay = new Date(nowMs).getUTCDay(); // 0 = Sunday, 1 = Monday, 6 = Saturday
    // Over the weekend or early Monday, allow up to 72 hours age for Friday's ECB rate
    const threshold =
      nowDay === 0 || nowDay === 1 || nowDay === 6
        ? this.WEEKEND_STALENESS_MS
        : this.STALENESS_THRESHOLD_MS;
    return age > threshold;
  }

  async getRates(): Promise<GetRatesResponse> {
    let cached: GetRatesResponse | null = null;
    try {
      cached =
        (await this.cacheManager.get<GetRatesResponse>(this.CACHE_KEY)) ?? null;
    } catch (cacheErr: unknown) {
      this.logger.warn(
        `[currency_cache_read_failed] Falling back to DB: ${
          cacheErr instanceof Error ? cacheErr.message : cacheErr
        }`,
      );
    }

    if (cached && cached.rates && cached.meta) {
      return cached;
    }

    const dbRates = await this.prisma.currencyRate.findMany();
    const now = Date.now();

    const ratesMap: Record<string, string> = { USD: '1.000000' };
    const details: CurrencyRateInfo[] = [
      {
        code: 'USD',
        rateToBase: '1.000000',
        lastUpdated: new Date().toISOString(),
        provider: 'SYSTEM_BASE',
        isStale: false,
      },
    ];

    let eurRateDb: { rateToBase: Prisma.Decimal; lastUpdated: Date; provider: string | null } | null = null;

    for (const r of dbRates) {
      const upperCode = r.code.toUpperCase();
      if (this.isSupported(upperCode)) {
        const rateStr = new Prisma.Decimal(r.rateToBase).toFixed(6);
        const lastUpdatedMs = new Date(r.lastUpdated).getTime();
        const isStale = this.isDateStale(lastUpdatedMs, now);

        ratesMap[upperCode] = rateStr;
        details.push({
          code: upperCode,
          rateToBase: rateStr,
          lastUpdated: r.lastUpdated.toISOString(),
          provider: r.provider || 'DB_INGESTION',
          isStale,
        });

        if (upperCode === 'EUR') {
          eurRateDb = r;
        }
      }
    }

    let meta: CurrencyMetaInfo;

    if (eurRateDb) {
      const usdToEur = new Prisma.Decimal(eurRateDb.rateToBase);
      const eurToUsd = new Prisma.Decimal(1).div(usdToEur);
      const isStale = this.isDateStale(new Date(eurRateDb.lastUpdated).getTime(), now);

      meta = {
        ecbEurUsdRate: eurToUsd.toFixed(6),
        ecbUsdEurRate: usdToEur.toFixed(6),
        source: 'ECB',
        provider: eurRateDb.provider?.startsWith('ECB') ? 'Frankfurter' : (eurRateDb.provider || 'DB'),
        rateDate: eurRateDb.lastUpdated.toISOString().slice(0, 10),
        isStale,
        status: isStale ? 'stale' : 'fresh',
        lastUpdated: eurRateDb.lastUpdated.toISOString(),
      };
    } else {
      // Emergency fallback if database has not yet been populated
      ratesMap['EUR'] = this.SAFE_FALLBACK_EUR_RATE;
      details.push({
        code: 'EUR',
        rateToBase: this.SAFE_FALLBACK_EUR_RATE,
        lastUpdated: new Date().toISOString(),
        provider: 'STATIC_FALLBACK',
        isStale: false,
      });

      meta = {
        ecbEurUsdRate: this.SAFE_FALLBACK_EUR_USD,
        ecbUsdEurRate: this.SAFE_FALLBACK_EUR_RATE,
        source: 'ECB',
        provider: 'StaticFallback',
        rateDate: new Date().toISOString().slice(0, 10),
        isStale: false,
        status: 'fallback',
        lastUpdated: new Date().toISOString(),
      };
    }

    const response: GetRatesResponse = {
      base: 'USD',
      rates: ratesMap,
      details,
      timestamp: new Date().toISOString(),
      meta,
    };

    try {
      // 24 hour TTL for exchange rates cache
      await this.cacheManager.set(this.CACHE_KEY, response, 86400000);
    } catch (cacheErr: unknown) {
      this.logger.warn(
        `[currency_cache_write_failed] Cache update failed: ${
          cacheErr instanceof Error ? cacheErr.message : cacheErr
        }`,
      );
    }

    return response;
  }

  async convert(
    amountVal: number | string,
    fromCode: string,
    toCode: string,
  ): Promise<{
    originalAmount: string;
    from: string;
    to: string;
    convertedAmount: string;
    rateUsed: string;
    rateDate: string;
    source: string;
  }> {
    const fromUpper = fromCode.toUpperCase();
    const toUpper = toCode.toUpperCase();

    if (!this.isSupported(fromUpper)) {
      throw new BadRequestException(
        `Unsupported source currency: ${fromUpper}`,
      );
    }
    if (!this.isSupported(toUpper)) {
      throw new BadRequestException(`Unsupported target currency: ${toUpper}`);
    }

    const amountDecimal = new Prisma.Decimal(amountVal);
    if (amountDecimal.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    const rateData = await this.getRates();

    if (fromUpper === toUpper) {
      return {
        originalAmount: amountDecimal.toFixed(2),
        from: fromUpper,
        to: toUpper,
        convertedAmount: amountDecimal.toFixed(2),
        rateUsed: '1.000000',
        rateDate: rateData.meta.rateDate,
        source: rateData.meta.source,
      };
    }

    const rateFromStr = rateData.rates[fromUpper];
    const rateToStr = rateData.rates[toUpper];

    if (!rateFromStr || !rateToStr) {
      throw new ServiceUnavailableException(
        `Exchange rate not available for currency conversion (${fromUpper} -> ${toUpper})`,
      );
    }

    const rateFrom = new Prisma.Decimal(rateFromStr);
    const rateTo = new Prisma.Decimal(rateToStr);

    // Convert from source currency to USD base, then to target currency
    const baseUsd = amountDecimal.div(rateFrom);
    const converted = baseUsd.mul(rateTo);
    const effectiveRate = rateTo.div(rateFrom);

    return {
      originalAmount: amountDecimal.toFixed(2),
      from: fromUpper,
      to: toUpper,
      convertedAmount: converted.toFixed(2),
      rateUsed: effectiveRate.toFixed(6),
      rateDate: rateData.meta.rateDate,
      source: rateData.meta.source,
    };
  }

  async syncRatesNow(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.frankfurterProvider) {
      this.logger.warn('FrankfurterProvider not configured for rate sync');
      return { success: false, error: 'FrankfurterProvider not configured' };
    }

    try {
      this.logger.log('[currency_sync_started] Initiating on-demand rate synchronization...');
      const rateResult = await this.frankfurterProvider.fetchEurUsdRate();

      // In the USD base model, rateToBase for EUR is units of EUR per 1 USD
      // e.g. 1 USD = 0.888650 EUR
      const rateDecimal = new Prisma.Decimal(rateResult.inverseRate);

      const upserted = await this.prisma.currencyRate.upsert({
        where: { code: 'EUR' },
        update: {
          rateToBase: rateDecimal,
          lastUpdated: new Date(),
          provider: `ECB_FRANKFURTER_${rateResult.date}`,
        },
        create: {
          code: 'EUR',
          rateToBase: rateDecimal,
          lastUpdated: new Date(),
          provider: `ECB_FRANKFURTER_${rateResult.date}`,
        },
      });

      try {
        await this.prisma.currencyRateHistory.upsert({
          where: {
            code_rateDate_provider: {
              code: 'EUR',
              rateDate: rateResult.date,
              provider: 'Frankfurter',
            },
          },
          update: {
            rateToBase: rateDecimal,
            inverseRate: new Prisma.Decimal(rateResult.rate),
            source: 'ECB',
          },
          create: {
            code: 'EUR',
            base: 'USD',
            rateToBase: rateDecimal,
            inverseRate: new Prisma.Decimal(rateResult.rate),
            rateDate: rateResult.date,
            provider: 'Frankfurter',
            source: 'ECB',
          },
        });
      } catch (histErr) {
        this.logger.warn(`Failed to record CurrencyRateHistory: ${histErr instanceof Error ? histErr.message : histErr}`);
      }

      await this.cacheManager.del(this.CACHE_KEY);
      const freshRates = await this.getRates();

      this.logger.log(
        `[currency_sync_success] Currency rate sync succeeded: 1 EUR = ${rateResult.rate} USD, 1 USD = ${rateResult.inverseRate} EUR`,
      );

      return {
        success: true,
        data: {
          upserted,
          meta: freshRates.meta,
          rates: freshRates.rates,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[currency_sync_failed] On-demand rate sync failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async updateRatesAdmin(
    rates: Array<{
      code: string;
      rateToBase: number | string;
      provider?: string;
    }>,
    adminUserId: string,
  ) {
    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      throw new BadRequestException('Rates array is required');
    }

    const results = [];
    for (const item of rates) {
      const codeUpper = item.code?.toUpperCase();
      if (!codeUpper || !this.isSupported(codeUpper)) {
        throw new BadRequestException(
          `Currency ${item.code} is not in the supported ISO allowlist (${SUPPORTED_CURRENCIES.join(
            ', ',
          )})`,
        );
      }

      const rateDecimal = new Prisma.Decimal(item.rateToBase);
      if (rateDecimal.lte(0)) {
        throw new BadRequestException(
          `Exchange rate for ${codeUpper} must be positive`,
        );
      }

      const updated = await this.prisma.currencyRate.upsert({
        where: { code: codeUpper },
        update: {
          rateToBase: rateDecimal,
          lastUpdated: new Date(),
          provider: item.provider || 'ADMIN_MANUAL',
        },
        create: {
          code: codeUpper,
          rateToBase: rateDecimal,
          lastUpdated: new Date(),
          provider: item.provider || 'ADMIN_MANUAL',
        },
      });
      results.push(updated);
    }

    await this.cacheManager.del(this.CACHE_KEY);
    await this.getRates(); // Refresh cache immediately
    this.logger.log(
      `Updated ${results.length} currency rates by admin ${adminUserId}`,
    );
    return { success: true, updatedCount: results.length, rates: results };
  }

  // Scheduled daily sync: Mon-Fri at 16:30 CET (17:30 Cairo) after ECB publishes reference rates
  @Cron('30 16 * * 1-5')
  async handleDailyRateSync(): Promise<void> {
    this.logger.log(
      '[currency_sync_cron] Executing automated daily currency exchange rate synchronization...',
    );
    try {
      if (this.frankfurterProvider) {
        await this.syncRatesNow();
      } else {
        await this.cacheManager.del(this.CACHE_KEY);
        const ratesData = await this.getRates();
        const staleCurrencies = ratesData.details
          .filter((d) => d.isStale)
          .map((d) => d.code);

        if (staleCurrencies.length > 0) {
          this.logger.warn(
            `[currency_sync_cron] Stale exchange rates detected for: ${staleCurrencies.join(', ')}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `[currency_sync_cron_failed] Automated daily currency sync failed: ${error?.message || error}`,
        error?.stack,
      );
    }
  }

  async getEurUsdRate(): Promise<{
    ecbEurUsdRate: string;
    ecbUsdEurRate: string;
    rateDate: string;
    source: string;
  }> {
    const res = await this.getRates();
    return {
      ecbEurUsdRate: res.meta?.ecbEurUsdRate || '1.125300',
      ecbUsdEurRate: res.meta?.ecbUsdEurRate || '0.888650',
      rateDate: res.meta?.rateDate || new Date().toISOString(),
      source: res.meta?.source || 'ECB',
    };
  }
}
