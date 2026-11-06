import { Module } from '@nestjs/common';
import { TransportPricingService } from './transport-pricing.service';
import { TransportPricingController } from './transport-pricing.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TransportPricingController],
  providers: [TransportPricingService],
  exports: [TransportPricingService],
})
export class TransportPricingModule {}