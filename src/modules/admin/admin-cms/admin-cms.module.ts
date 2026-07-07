import { Module } from '@nestjs/common';
import { AdminCmsController } from './admin-cms.controller';
import { AdminCmsService } from './admin-cms.service';

@Module({
  controllers: [AdminCmsController],
  providers: [AdminCmsService],
})
export class AdminCmsModule {}
