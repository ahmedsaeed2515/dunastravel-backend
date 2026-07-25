import { Module } from '@nestjs/common';
import { AdminCurrenciesController } from './admin-currencies.controller';
import { AdminCurrenciesService } from './admin-currencies.service';
import { CurrencyModule } from '../../currency/currency.module';

@Module({
  imports: [CurrencyModule],
  controllers: [AdminCurrenciesController],
  providers: [AdminCurrenciesService],
  exports: [AdminCurrenciesService],
})
export class AdminCurrenciesModule {}
