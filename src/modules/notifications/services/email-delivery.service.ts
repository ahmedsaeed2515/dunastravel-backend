import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationDeliveryStatus as PrismaDeliveryStatus,
  NotificationType as PrismaNotificationType,
} from '@prisma/client';
import { NotificationType } from '../types';
import { EmailPayload } from '../types/email-payload.type';
import {
  IEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../providers/email-provider.interface';

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly providerAdapter: IEmailProvider,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(
    notificationType: NotificationType,
    originReferenceCode: string,
    originEntityType: string,
    payload: EmailPayload,
  ): Promise<void> {
    // 1. Create PENDING log entry
    const logRecord = this.prisma?.notificationDeliveryLog
      ? await this.prisma.notificationDeliveryLog.create({
          data: {
            notificationType: notificationType as unknown as PrismaNotificationType,
            originReferenceCode,
            originEntityType,
            recipientEmail: payload.to,
            status: PrismaDeliveryStatus.PENDING,
          },
        })
      : null;

    let attempts = 0;
    let success = false;

    // 2. Delivery loop
    while (attempts < this.MAX_RETRIES && !success) {
      attempts++;
      try {
        const result = await this.providerAdapter.send(payload);
        if (result.status === 'SUCCESS') {
          success = true;
          if (logRecord && this.prisma?.notificationDeliveryLog) {
            await this.prisma.notificationDeliveryLog.update({
              where: { id: logRecord.id },
              data: {
                status: PrismaDeliveryStatus.SENT,
                attempts,
                lastAttemptAt: new Date(),
                providerResponseId: result.providerMessageId || null,
              },
            });
          }
          this.logger.log(
            `Successfully sent ${notificationType} to ${payload.to}`,
          );
        } else {
          throw new Error(
            result.providerError || 'Provider reported failure without reason',
          );
        }
      } catch (error: unknown) {
        const err = error as Error;
        this.logger.warn(
          `Failed to send ${notificationType} (attempt ${attempts}): ${err.message}`,
        );

        const isExhausted = attempts >= this.MAX_RETRIES;

        if (logRecord && this.prisma?.notificationDeliveryLog) {
          await this.prisma.notificationDeliveryLog.update({
            where: { id: logRecord.id },
            data: {
              status: isExhausted
                ? PrismaDeliveryStatus.EXHAUSTED
                : PrismaDeliveryStatus.FAILED,
              attempts,
              lastAttemptAt: new Date(),
              failureReason: err.message,
            },
          });
        }

        if (isExhausted) {
          this.logger.error(
            `[CRITICAL] Terminal failure for ${notificationType} after ${attempts} attempts. Reference: ${originReferenceCode}`,
          );
        } else {
          // In-process backoff
          await new Promise((res) => setTimeout(res, 1000 * attempts));
        }
      }
    }
  }
}
