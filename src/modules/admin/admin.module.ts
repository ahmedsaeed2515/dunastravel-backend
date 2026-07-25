import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { BookingsModule } from '../bookings/bookings.module';
import { AdminPromotionsModule } from './admin-promotions/admin-promotions.module';
import { AdminTransportationModule } from './admin-transportation/admin-transportation.module';
import { AdminTailorMadeModule } from './admin-tailor-made/admin-tailor-made.module';
import { AdminInvoicesModule } from './admin-invoices/admin-invoices.module';
import { AdminWalletsModule } from './admin-wallets/admin-wallets.module';
import { AdminAgenciesModule } from './admin-agencies/admin-agencies.module';
import { AdminBlogsModule } from './admin-blogs/admin-blogs.module';
import { AdminFaqsModule } from './admin-faqs/admin-faqs.module';
import { AdminCurrenciesModule } from './admin-currencies/admin-currencies.module';
import { AdminCmsModule } from './admin-cms/admin-cms.module';
import { AdminReportsModule } from './admin-reports/admin-reports.module';
import { AdminFinanceModule } from './admin-finance/admin-finance.module';
import { ContactSubmissionsModule } from '../contact-submissions/contact-submissions.module';

@Module({
  imports: [
    AdminTransportationModule,
    AdminTailorMadeModule,
    AdminInvoicesModule,
    AdminWalletsModule,
    AdminAgenciesModule,
    AdminBlogsModule,
    AdminFaqsModule,
    AdminCurrenciesModule,
    BookingsModule,
    ContactSubmissionsModule,
    AdminPromotionsModule,
    AdminCmsModule,
    AdminReportsModule,
    AdminFinanceModule,
  ],

  controllers: [AdminController],
  providers: [AdminService, BackupService],
})
export class AdminModule {}
