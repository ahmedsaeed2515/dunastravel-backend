import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaymentCronService } from './payment-cron.service';

@Module({
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
