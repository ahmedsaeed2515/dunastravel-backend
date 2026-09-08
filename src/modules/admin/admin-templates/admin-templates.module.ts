import { Module } from '@nestjs/common';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminTemplatesService } from './admin-templates.service';
import { NotificationsModule } from '../../notifications/notifications.module';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [AdminTemplatesController],
  providers: [AdminTemplatesService],
  exports: [AdminTemplatesService],
})
export class AdminTemplatesModule {}
