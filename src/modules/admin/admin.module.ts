import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminPromotionsModule } from './admin-promotions/admin-promotions.module';
import { AdminCmsModule } from './admin-cms/admin-cms.module';
import { AdminReportsModule } from './admin-reports/admin-reports.module';

@Module({
  imports: [
    BookingsModule,
    AdminPromotionsModule,
    AdminCmsModule,
    AdminReportsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, BackupService],
})
export class AdminModule {}
