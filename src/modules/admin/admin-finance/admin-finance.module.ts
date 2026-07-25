import { Module } from '@nestjs/common';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { PaymentsModule } from '../../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [AdminFinanceController],
  providers: [AdminFinanceService],
  exports: [AdminFinanceService],
})
export class AdminFinanceModule {}
