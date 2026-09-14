import { Module } from '@nestjs/common';
import { DestinationsController } from './destinations.controller';
import { DestinationsAdminController } from './destinations-admin.controller';
import { DestinationsService } from './destinations.service';
import { ToursModule } from '../tours/tours.module';

@Module({
  imports: [ToursModule],
  controllers: [DestinationsController, DestinationsAdminController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
