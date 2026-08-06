import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaymentCronService } from './payment-cron.service';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [CommissionsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: IPaymentGatewayPort,
      useClass: StripeAdapter,
    },
    PaymentCronService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
