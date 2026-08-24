import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminHotelsController } from './admin-hotels.controller';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';

@Module({
  imports: [PrismaModule],
  controllers: [HotelsController, AdminHotelsController],
  providers: [HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
