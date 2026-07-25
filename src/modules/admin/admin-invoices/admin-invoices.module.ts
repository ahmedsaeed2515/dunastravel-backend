import { Module } from '@nestjs/common';
import { AdminInvoicesController } from './admin-invoices.controller';
import { AdminInvoicesService } from './admin-invoices.service';
import { PaymentsModule } from '../../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [AdminInvoicesController],
  providers: [AdminInvoicesService],
  exports: [AdminInvoicesService],
})
export class AdminInvoicesModule {}
