import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CurrencyRateResult,
  ICurrencyProvider,
} from './currency-provider.interface';

@Injectable()
export class FrankfurterProvider implements ICurrencyProvider {
  private readonly logger = new Logger(FrankfurterProvider.name);
  private readonly PRIMARY_URL =
    'https://api.frankfurter.dev/v2/providers/ecb/rate/eur/usd';
  private readonly FALLBACK_URL =
    'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD';
  private readonly TIMEOUT_MS = 5000;
  private readonly MAX_RETRIES = 3;

  getProviderName(): string {
    return 'Frankfurter';
  }

  async fetchEurUsdRate(): Promise<CurrencyRateResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(
          `[currency_sync_attempt] Fetching ECB rate via Frankfurter (attempt ${attempt}/${this.MAX_RETRIES})`,
        );
        const result = await this.tryFetchPrimary();
        return result;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `[currency_sync_attempt_failed] Primary endpoint attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < this.MAX_RETRIES) {
          const delayMs = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // Try fallback v1 endpoint once if primary fails all retries
    this.logger.warn(
      '[currency_sync_fallback] Attempting Frankfurter v1 fallback endpoint...',
    );
    try {
      return await this.tryFetchFallback();
    } catch (fallbackErr: unknown) {
      const msg =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr);
      this.logger.error(
        `[currency_sync_failed] Both primary and fallback Frankfurter endpoints failed: ${msg}`,
      );
      throw lastError || fallbackErr;
    }
  }

  private async tryFetchPrimary(): Promise<CurrencyRateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const res = await fetch(this.PRIMARY_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(
          `Frankfurter returned HTTP ${res.status}: ${res.statusText}`,
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      return this.validateAndParseResponse(data, 'v2');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async tryFetchFallback(): Promise<CurrencyRateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const res = await fetch(this.FALLBACK_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(
          `Frankfurter v1 fallback returned HTTP ${res.status}: ${res.statusText}`,
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      return this.validateAndParseResponse(data, 'v1');
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateAndParseResponse(
    data: Record<string, unknown>,
    version: 'v1' | 'v2',
  ): CurrencyRateResult {
    if (!data || typeof data !== 'object') {
      throw new Error('Malformed Frankfurter response: body is not an object');
    }

    let rateNum: number | undefined;
    let rateDate: string | undefined;

    if (version === 'v2') {
      // {"date":"2026-10-16","base":"EUR","quote":"USD","rate":1.1253}
      if (typeof data.rate === 'number') {
        rateNum = data.rate;
      }
      if (typeof data.date === 'string') {
        rateDate = data.date;
      }
    } else {
      // v1: {"amount":1.0,"base":"EUR","date":"2026-10-16","rates":{"USD":1.1253}}
      const rates = data.rates as Record<string, unknown> | undefined;
      if (rates && typeof rates.USD === 'number') {
        rateNum = rates.USD;
      }
      if (typeof data.date === 'string') {
        rateDate = data.date;
      }
    }

    if (rateNum === undefined || !Number.isFinite(rateNum) || rateNum <= 0) {
      throw new Error(
        `Invalid or non-positive exchange rate received: ${rateNum}`,
      );
    }

    // Sanity boundary check: realistic historical EUR/USD range is [0.50, 2.00]
    if (rateNum < 0.5 || rateNum > 2.0) {
      throw new Error(
        `Exchange rate out of realistic bounds (0.50 - 2.00): ${rateNum}`,
      );
    }

    const rateDecimal = new Prisma.Decimal(rateNum);
    // 1 EUR = rateNum USD. E.g. rate = 1.125300
    const rateStr = rateDecimal.toFixed(6);

    // Inverse rate: 1 USD = (1 / rateNum) EUR. E.g. 1 / 1.1253 = 0.888652
    const inverseDecimal = new Prisma.Decimal(1).div(rateDecimal);
    const inverseStr = inverseDecimal.toFixed(6);

    const todayIso = new Date().toISOString().slice(0, 10);
    const resolvedDate = rateDate || todayIso;

    this.logger.log(
      `[currency_rate_validated] Successfully validated ECB reference: 1 EUR = ${rateStr} USD (1 USD = ${inverseStr} EUR), Date: ${resolvedDate}`,
    );

    return {
      base: 'EUR',
      quote: 'USD',
      rate: rateStr,
      inverseRate: inverseStr,
      date: resolvedDate,
      source: 'ECB',
      provider: 'Frankfurter',
      fetchedAt: new Date().toISOString(),
    };
  }
}
