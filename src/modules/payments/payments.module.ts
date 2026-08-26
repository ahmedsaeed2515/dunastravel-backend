import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { GetPayInGatewayAdapter } from './adapters/getpayin-gateway.adapter';
import { DisabledPaymentGatewayAdapter } from './adapters/disabled-gateway.adapter';
import { PaymentCronService } from './payment-cron.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [CommissionsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    GetPayInGatewayAdapter,
    DisabledPaymentGatewayAdapter,
    {
      provide: IPaymentGatewayPort,
      inject: [
        ConfigService,
        GetPayInGatewayAdapter,
        DisabledPaymentGatewayAdapter,
      ],
      useFactory: (
        config: ConfigService,
        getPayIn: GetPayInGatewayAdapter,
        disabled: DisabledPaymentGatewayAdapter,
      ) => {
        const provider = config
          .get<string>('payments.provider', 'DISABLED')
          .trim()
          .toUpperCase();
        if (provider === 'GETPAYIN') return getPayIn;
        return disabled;
      },
    },
    PaymentCronService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
