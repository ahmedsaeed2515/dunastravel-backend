import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { MockEmailProvider } from './providers/mock-email.provider';
import { EMAIL_PROVIDER_TOKEN } from './providers/email-provider.interface';
import { InquiryCreatedListener } from './listeners/inquiry-created.listener';
import { ContactCreatedListener } from './listeners/contact-created.listener';
import { BookingCreatedListener } from './listeners/booking-created.listener';

const EmailProviderFactory = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: (configService: ConfigService) => {
    const transport = configService.get<string>('mail.transport');
    if (transport === 'resend') {
      return new ResendEmailProvider(configService);
    }
    return new MockEmailProvider();
  },
  inject: [ConfigService],
};

@Module({
  providers: [
    EmailProviderFactory,
    EmailCompositionService,
    EmailDeliveryService,
    InquiryCreatedListener,
    ContactCreatedListener,
    BookingCreatedListener,
  ],
  exports: [],
})
export class NotificationsModule {}
