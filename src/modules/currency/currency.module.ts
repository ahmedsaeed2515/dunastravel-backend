import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { PublicCurrencyController } from './public-currency.controller';
import { FrankfurterProvider } from './providers/frankfurter.provider';

@Module({
  controllers: [CurrencyController, PublicCurrencyController],
  providers: [CurrencyService, FrankfurterProvider],
  exports: [CurrencyService, FrankfurterProvider],
})
export class CurrencyModule {}
