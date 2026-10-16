import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [PrismaModule, CurrencyModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
