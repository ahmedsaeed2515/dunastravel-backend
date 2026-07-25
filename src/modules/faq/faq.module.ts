import { Module } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { AdminFaqController } from './admin-faq.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
