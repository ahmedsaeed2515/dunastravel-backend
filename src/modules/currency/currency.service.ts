import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly CACHE_KEY = 'global_exchange_rates_v2';
  private readonly STALENESS_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  isSupported(code: string): boolean {
    return SUPPORTED_CURRENCIES.includes(
      code.toUpperCase() as SupportedCurrency,
    );
  }

  async getRates(): Promise<{
    base: string;
    rates: Record<string, string>;
    details: CurrencyRateInfo[];
    timestamp: string;
  }> {
    const cached = await this.cacheManager.get<{
      base: string;
      rates: Record<string, string>;
      details: CurrencyRateInfo[];
      timestamp: string;
    }>(this.CACHE_KEY);

    if (cached) {
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

    for (const r of dbRates) {
      const upperCode = r.code.toUpperCase();
      if (this.isSupported(upperCode)) {
        const rateStr = new Prisma.Decimal(r.rateToBase).toFixed(6);
        const lastUpdatedMs = new Date(r.lastUpdated).getTime();
        const isStale = now - lastUpdatedMs > this.STALENESS_THRESHOLD_MS;

        ratesMap[upperCode] = rateStr;
        details.push({
          code: upperCode,
          rateToBase: rateStr,
          lastUpdated: r.lastUpdated.toISOString(),
          provider: r.provider || 'DB_INGESTION',
          isStale,
        });
      }
    }

    const response = {
      base: 'USD',
      rates: ratesMap,
      details,
      timestamp: new Date().toISOString(),
    };

    await this.cacheManager.set(this.CACHE_KEY, response, 300000); // 5 min TTL
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

    if (fromUpper === toUpper) {
      return {
        originalAmount: amountDecimal.toFixed(2),
        from: fromUpper,
        to: toUpper,
        convertedAmount: amountDecimal.toFixed(2),
        rateUsed: '1.000000',
      };
    }

    const rateData = await this.getRates();
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
    };
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
          `Currency ${item.code} is not in the supported ISO allowlist (${SUPPORTED_CURRENCIES.join(', ')})`,
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
    this.logger.log(
      `Updated ${results.length} currency rates by admin ${adminUserId}`,
    );
    return { success: true, updatedCount: results.length, rates: results };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRateSync(): Promise<void> {
    this.logger.log('Executing automated daily currency exchange rate synchronization...');
    try {
      await this.cacheManager.del(this.CACHE_KEY);
      const ratesData = await this.getRates();

      const staleCurrencies = ratesData.details
        .filter((d) => d.isStale)
        .map((d) => d.code);

      if (staleCurrencies.length > 0) {
        this.logger.warn(
          `Automated daily rate sync complete with stale exchange rates detected for: ${staleCurrencies.join(', ')}`,
        );
      } else {
        this.logger.log(
          `Automated daily currency exchange rate synchronization completed successfully for ${ratesData.details.length} currencies.`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to complete automated daily currency exchange rate sync: ${error?.message || error}`,
        error?.stack,
      );
    }
  }
}

