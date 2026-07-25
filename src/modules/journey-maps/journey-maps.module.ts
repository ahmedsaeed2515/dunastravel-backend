import { Module } from '@nestjs/common';
import { JourneyMapsController } from './journey-maps.controller';
import { AdminJourneyMapsController } from './admin-journey-maps.controller';
import { JourneyMapsService } from './journey-maps.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [JourneyMapsController, AdminJourneyMapsController],
  providers: [JourneyMapsService],
  exports: [JourneyMapsService],
})
export class JourneyMapsModule {}
