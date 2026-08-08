import { Module, Global } from '@nestjs/common';
import { InAppNotificationsService } from './in-app-notifications.service';
import { InAppNotificationsController } from './in-app-notifications.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [InAppNotificationsController],
  providers: [InAppNotificationsService],
  exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
