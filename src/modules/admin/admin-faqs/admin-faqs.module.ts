import { Module } from '@nestjs/common';
import { AdminFaqsController } from './admin-faqs.controller';
import { AdminFaqsService } from './admin-faqs.service';

@Module({
  controllers: [AdminFaqsController],
  providers: [AdminFaqsService],
  exports: [AdminFaqsService],
})
export class AdminFaqsModule {}
