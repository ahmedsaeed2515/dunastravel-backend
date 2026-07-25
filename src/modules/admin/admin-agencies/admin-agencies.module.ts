import { Module } from '@nestjs/common';
import { AdminAgenciesController } from './admin-agencies.controller';
import { AdminAgenciesService } from './admin-agencies.service';

@Module({
  controllers: [AdminAgenciesController],
  providers: [AdminAgenciesService],
  exports: [AdminAgenciesService],
})
export class AdminAgenciesModule {}
