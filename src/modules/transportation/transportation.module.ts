import { Module } from '@nestjs/common';
import { TransportationService } from './transportation.service';
import { TransportationController } from './transportation.controller';
import { AdminTransportationController } from './admin-transportation.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TransportationController, AdminTransportationController],
  providers: [TransportationService],
  exports: [TransportationService],
})
export class TransportationModule {}
