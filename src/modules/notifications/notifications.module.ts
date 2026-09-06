import { Module, ServiceUnavailableException } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { MockEmailProvider } from './providers/mock-email.provider';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { InquiryCreatedListener } from './listeners/inquiry-created.listener';
import { ContactCreatedListener } from './listeners/contact-created.listener';
import { BookingCreatedListener } from './listeners/booking-created.listener';
import { PaymentEventsListener } from './listeners/payment.listener';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CommissionsModule } from '../commissions/commissions.module';

import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';

const EmailProviderFactory = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: (configService: ConfigService) => {
    const transport = configService.get<string>('mail.transport');
    if (transport === 'resend') {
      return new ResendEmailProvider(configService);
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'A real email provider is required in production',
      );
    }
    return new MockEmailProvider();
  },
  inject: [ConfigService],
};

import configuration from '../../config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    CommissionsModule,
    InAppNotificationsModule,
    CacheModule.register({ isGlobal: true }),
  ],
  controllers: [NotificationsController],
  providers: [
    EmailProviderFactory,
    EmailCompositionService,
    EmailDeliveryService,
    NotificationsService,
    InquiryCreatedListener,
    ContactCreatedListener,
    BookingCreatedListener,
    PaymentEventsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
