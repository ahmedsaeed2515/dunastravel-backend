import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { GenericPaymentGatewayAdapter } from './adapters/generic-gateway.adapter';
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
    GenericPaymentGatewayAdapter,
    GetPayInGatewayAdapter,
    DisabledPaymentGatewayAdapter,
    {
      provide: IPaymentGatewayPort,
      inject: [
        ConfigService,
        GenericPaymentGatewayAdapter,
        GetPayInGatewayAdapter,
        DisabledPaymentGatewayAdapter,
      ],
      useFactory: (
        config: ConfigService,
        generic: GenericPaymentGatewayAdapter,
        getPayIn: GetPayInGatewayAdapter,
        disabled: DisabledPaymentGatewayAdapter,
      ) => {
        const provider = config
          .get<string>('payments.provider', 'DISABLED')
          .trim()
          .toUpperCase();
        if (provider === 'GETPAYIN') return getPayIn;
        if (provider === 'GENERIC' && config.get('nodeEnv') !== 'production') {
          return generic;
        }
        return disabled;
      },
    },
    PaymentCronService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
