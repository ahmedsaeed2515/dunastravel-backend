import { Module } from '@nestjs/common';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminTemplatesService } from './admin-templates.service';

@Module({
  controllers: [AdminTemplatesController],
  providers: [AdminTemplatesService],
  exports: [AdminTemplatesService],
})
export class AdminTemplatesModule {}
