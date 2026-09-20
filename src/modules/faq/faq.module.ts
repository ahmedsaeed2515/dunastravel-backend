import { Module } from '@nestjs/common';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { AdminFaqController } from './admin-faq.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { DunasCacheModule } from '../../common/cache/dunas-cache.module';

@Module({
  imports: [PrismaModule, DunasCacheModule],
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
