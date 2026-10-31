import { Logger, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { EmailRetrySchedulerService } from './services/email-retry-scheduler.service';
import { EmailSuppressionService } from './services/email-suppression.service';
import { TemplateRegistryService } from './templates/template-registry.service';
import { BrevoEmailProvider } from './providers/brevo-email.provider';
import { MockEmailProvider } from './providers/mock-email.provider';
import {
  EMAIL_PROVIDER_TOKEN,
  IEmailProvider,
} from './providers/email-provider.interface';
import { EmailPayload, EmailResult } from './types/email-payload.type';
import { EmailDeliveryException } from './exceptions/email-delivery.exception';
import { InquiryCreatedListener } from './listeners/inquiry-created.listener';
import { ContactCreatedListener } from './listeners/contact-created.listener';
import { BookingCreatedListener } from './listeners/booking-created.listener';
import { PaymentEventsListener } from './listeners/payment.listener';
import { ReviewCreatedListener } from './listeners/review-created.listener';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CommissionsModule } from '../commissions/commissions.module';
import { InAppNotificationsModule } from '../in-app-notifications/in-app-notifications.module';
import configuration from '../../config/configuration';

/**
 * Fail-closed provider used when the selected transport has no credentials.
 *
 * The API must keep booting so authentication and every non-email endpoint
 * stay available; only email delivery itself is refused. Each attempt throws a
 * non-transient delivery error so the retry scheduler does not loop forever.
 */
class UnconfiguredEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(UnconfiguredEmailProvider.name);

  constructor(private readonly reason: string) {}

  async send(_payload: EmailPayload): Promise<EmailResult> {
    this.logger.error(
      `Email delivery is disabled: ${this.reason}. No message was sent.`,
    );
    throw new EmailDeliveryException(
      `Email delivery is not configured: ${this.reason}`,
      'EMAIL_PROVIDER_NOT_CONFIGURED',
      undefined,
      false,
    );
  }
}

const EmailProviderFactory = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: (configService: ConfigService) => {
    const logger = new Logger('EmailProvider');
    const transport = (
      configService.get<string>('mail.transport') || ''
    ).toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';
    const brevoApiKey =
      configService.get<string>('mail.brevoApiKey') ||
      configService.get<string>('mail.apiKey') ||
      process.env.BREVO_API_KEY;

    // `resend` is a legacy alias: the runtime only ships the Brevo adapter.
    if (transport === 'brevo' || transport === 'resend') {
      if (!brevoApiKey || !brevoApiKey.trim()) {
        logger.error(
          'BREVO_API_KEY is not configured. The API will keep running but email delivery is disabled.',
        );
        return new UnconfiguredEmailProvider('BREVO_API_KEY is missing');
      }

      try {
        return new BrevoEmailProvider(configService);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown provider error';
        logger.error(
          `Email provider could not be initialized (${message}). Email delivery is disabled.`,
        );
        return new UnconfiguredEmailProvider(message);
      }
    }

    if (isProduction) {
      logger.error(
        `Unsupported MAIL_TRANSPORT "${transport}" in production. Email delivery is disabled.`,
      );
      return new UnconfiguredEmailProvider(
        `unsupported MAIL_TRANSPORT "${transport}"`,
      );
    }

    return new MockEmailProvider();
  },
  inject: [ConfigService],
};

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
    TemplateRegistryService,
    EmailSuppressionService,
    EmailCompositionService,
    EmailDeliveryService,
    EmailRetrySchedulerService,
    NotificationsService,
    InquiryCreatedListener,
    ContactCreatedListener,
    BookingCreatedListener,
    PaymentEventsListener,
    ReviewCreatedListener,
  ],
  exports: [
    NotificationsService,
    EmailDeliveryService,
    TemplateRegistryService,
    EmailSuppressionService,
    EmailCompositionService,
  ],
})
export class NotificationsModule {}
