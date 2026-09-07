import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { GetPayInGatewayAdapter } from './adapters/getpayin-gateway.adapter';
import { DisabledPaymentGatewayAdapter } from './adapters/disabled-gateway.adapter';
import { MockPaymentGatewayAdapter } from './adapters/mock-gateway.adapter';
import { PaymentCronService } from './payment-cron.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { AvailabilityModule } from '../availability/availability.module';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [CommissionsModule, AvailabilityModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    GetPayInGatewayAdapter,
    DisabledPaymentGatewayAdapter,
    MockPaymentGatewayAdapter,
    {
      provide: IPaymentGatewayPort,
      inject: [
        ConfigService,
        GetPayInGatewayAdapter,
        DisabledPaymentGatewayAdapter,
        MockPaymentGatewayAdapter,
      ],
      useFactory: (
        config: ConfigService,
        getPayIn: GetPayInGatewayAdapter,
        disabled: DisabledPaymentGatewayAdapter,
        mock: MockPaymentGatewayAdapter,
      ) => {
        const provider = config
          .get<string>('payments.provider', 'DISABLED')
          .trim()
          .toUpperCase();
        if (provider === 'GETPAYIN') return getPayIn;
        if (provider === 'MOCK' || provider === 'SANDBOX') return mock;
        return disabled;
      },
    },
    PaymentCronService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
