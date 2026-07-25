import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AdminAvailabilityController } from './admin-availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  controllers: [AvailabilityController, AdminAvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
