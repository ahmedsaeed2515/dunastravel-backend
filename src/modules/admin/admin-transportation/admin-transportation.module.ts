import { Module } from '@nestjs/common';
import { AdminTransportationController } from './admin-transportation.controller';
import { AdminTransportationService } from './admin-transportation.service';

@Module({
  controllers: [AdminTransportationController],
  providers: [AdminTransportationService],
  exports: [AdminTransportationService],
})
export class AdminTransportationModule {}
