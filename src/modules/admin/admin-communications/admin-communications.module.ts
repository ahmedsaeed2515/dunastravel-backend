import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AdminCommunicationsController } from './admin-communications.controller';
import { AdminCommunicationsService } from './admin-communications.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [AdminCommunicationsController],
  providers: [AdminCommunicationsService],
  exports: [AdminCommunicationsService],
})
export class AdminCommunicationsModule {}
