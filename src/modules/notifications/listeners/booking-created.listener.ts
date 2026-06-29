import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { BOOKING_EVENTS } from '../../../common/events';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import {
  IEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../providers/email-provider.interface';
import { NotificationType, NotificationDeliveryStatus } from '../types';
import { renderBookingCustomerConfirmation } from '../templates/booking-confirmation.template';
import { renderBookingInternalAlert } from '../templates/booking-alert.template';
import { EmailPayload } from '../types/email-payload.type';

@Injectable()
export class BookingCreatedListener {
  private readonly logger = new Logger(BookingCreatedListener.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent(BOOKING_EVENTS.CREATED, { async: true })
  async handleBookingCreatedEvent(payload: BookingCreatedPayload) {
    if (!payload?.referenceCode) {
      this.logger.error(
        'Malformed booking.created payload received, skipping. Missing fields: referenceCode',
      );
      return;
    }
    if (!payload.customerEmail || !payload.customerEmail.includes('@')) {
      this.logger.error(
        'Malformed booking.created payload received, skipping. Missing fields: customerEmail',
      );
      return;
    }

    this.logger.log(
      `Received booking.created event for referenceCode: ${payload.referenceCode}`,
    );

    try {
      const adminDashboardUrl =
        this.configService.get<string>('mail.adminDashboardBaseUrl') ||
        'http://localhost:3000/admin';
      const internalRecipient =
        this.configService.get<string>('mail.internalAlertRecipient') ||
        'sales@dunastravel.com';

      const customerPayload = renderBookingCustomerConfirmation(payload);
      const salesPayload = renderBookingInternalAlert(
        payload,
        internalRecipient,
        adminDashboardUrl,
      );

      await Promise.all([
        this.deliverWithRetry(
          NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          payload.referenceCode,
          customerPayload,
          'customer',
        ),
        this.deliverWithRetry(
          NotificationType.INTERNAL_SALES_ALERT,
          payload.referenceCode,
          salesPayload,
          'sales team',
        ),
      ]);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to process booking.created event: ${err.message}`,
        err.stack,
      );
    }
  }

  private async deliverWithRetry(
    notificationType: NotificationType,
    referenceCode: string,
    payload: EmailPayload,
    recipientType: string,
  ): Promise<void> {
    if (recipientType === 'customer') {
      this.logger.log(
        `Sending booking confirmation to customer: ${payload.to} for booking: ${referenceCode}`,
      );
    } else {
      this.logger.log(
        `Sending booking alert to sales team for booking: ${referenceCode}`,
      );
    }

    this.logger.debug(`Writing PENDING log for ${referenceCode}`);
    const logRecord = await this.prisma.notificationDeliveryLog.create({
      data: {
        notificationType,
        originReferenceCode: referenceCode,
        originEntityType: 'BOOKING',
        recipientEmail: payload.to,
        status: NotificationDeliveryStatus.PENDING,
      },
    });

    let attempts = 0;
    let success = false;

    while (attempts < this.MAX_RETRIES && !success) {
      attempts++;
      try {
        const result = await this.emailProvider.send(payload);
        if (result.status === 'SUCCESS') {
          success = true;
          this.logger.debug(`Writing SENT log for ${referenceCode}`);
          await this.prisma.notificationDeliveryLog.update({
            where: { id: logRecord.id },
            data: {
              status: NotificationDeliveryStatus.SENT,
              attempts,
              lastAttemptAt: new Date(),
              providerResponseId: result.providerMessageId,
            },
          });
          this.logger.log(
            `Booking confirmation delivered successfully for: ${referenceCode}, recipient: ${recipientType}`,
          );
        } else {
          throw new Error(result.providerError || 'Unknown provider error');
        }
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Booking confirmation delivery attempt ${attempts}/${this.MAX_RETRIES} failed for: ${referenceCode}, recipient: ${recipientType}, error: ${err.message}`,
        );

        const isExhausted = attempts >= this.MAX_RETRIES;
        this.logger.debug(
          `Writing ${isExhausted ? 'EXHAUSTED' : 'FAILED'} log for ${referenceCode}`,
        );
        await this.prisma.notificationDeliveryLog.update({
          where: { id: logRecord.id },
          data: {
            status: isExhausted
              ? NotificationDeliveryStatus.EXHAUSTED
              : NotificationDeliveryStatus.FAILED,
            attempts,
            lastAttemptAt: new Date(),
            failureReason: err.message,
          },
        });

        if (isExhausted) {
          this.logger.error(
            `Booking confirmation permanently failed for: ${referenceCode}, recipient: ${recipientType}`,
          );
        } else {
          await new Promise((res) => setTimeout(res, 1000 * attempts));
        }
      }
    }
  }
}
