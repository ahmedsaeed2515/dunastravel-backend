import { Injectable } from '@nestjs/common';
import { CurrencyService } from '../../currency/currency.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminCurrenciesService {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.currencyService.getRates();
  }

  async syncRates(adminUserId: string) {
    const result = await this.currencyService.syncRatesNow();
    await this.auditService.log({
      actorId: adminUserId,
      actorRole: 'SUPER_ADMIN',
      action: 'CURRENCY_RATES_SYNCED',
      entityType: 'CURRENCY_RATE',
      metadata: {
        success: result.success,
        source: 'ECB_FRANKFURTER',
      },
    });
    return result;
  }

  async updateRates(
    rates: Array<{
      code: string;
      rateToBase: number | string;
      provider?: string;
    }>,
    adminUserId: string,
  ) {
    const result = await this.currencyService.updateRatesAdmin(
      rates.map((rate) => ({
        code: rate.code,
        rateToBase: rate.rateToBase,
        provider: 'ADMIN_MANUAL',
      })),
      adminUserId,
    );
    await this.auditService.log({
      actorId: adminUserId,
      actorRole: 'SUPER_ADMIN',
      action: 'CURRENCY_RATES_UPDATED',
      entityType: 'CURRENCY_RATE',
      metadata: {
        currencies: rates.map((rate) => rate.code),
        count: rates.length,
      },
    });
    return result;
  }
}
