import { Injectable } from '@nestjs/common';
import { CurrencyService } from '../../currency/currency.service';

@Injectable()
export class AdminCurrenciesService {
  constructor(private readonly currencyService: CurrencyService) {}

  async findAll() {
    return this.currencyService.getRates();
  }

  async updateRates(
    rates: Array<{
      code: string;
      rateToBase: number | string;
      provider?: string;
    }>,
    adminUserId: string,
  ) {
    return this.currencyService.updateRatesAdmin(rates, adminUserId);
  }
}
