import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotificationDeliveryStatus as PrismaDeliveryStatus,
  NotificationType as PrismaNotificationType,
} from '@prisma/client';
import {
  EmailEventType,
  OriginEntityType,
  mapEventToPrismaNotificationType,
  SupportedLocale,
} from '../types/canonical-notification.types';
import { EmailPayload } from '../types/email-payload.type';
import {
  IEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from '../providers/email-provider.interface';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';
import { TemplateRegistryService } from '../templates/template-registry.service';
import { EmailSuppressionService } from './email-suppression.service';
import { redactEmailAddress } from '../../../common/utils/currency-formatter.util';
import crypto from 'crypto';

export interface DeliverOptions {
  eventType?: EmailEventType;
  notificationType?: PrismaNotificationType;
  originReferenceCode: string;
  originEntityType: OriginEntityType | string;
  payload: EmailPayload;
  idempotencyKey?: string;
  existingLogId?: string;
}

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly providerAdapter: IEmailProvider,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly templateRegistry?: TemplateRegistryService,
    private readonly suppressionService?: EmailSuppressionService,
  ) {}

  /**
   * Primary canonical delivery method.
   * Supports both legacy signature (notificationType, originRef, originEntity, payload)
   * and new DeliverOptions object signature.
   */
  async sendCanonicalNotification(options: {
    eventType: EmailEventType;
    recipientEmail: string;
    recipientName?: string;
    locale?: SupportedLocale;
    referenceCode: string;
    originEntityType?: string;
    existingLogId?: string;
    templateVariables?: Record<string, any>;
    customHeaders?: Record<string, string>;
  }): Promise<boolean> {
    const locale = options.locale || 'en';
    let subject = 'Dunas Travel Notification';
    let html = '<p>Notification</p>';
    let text = 'Notification';

    if (this.templateRegistry) {
      const rendered = this.templateRegistry.render(
        options.eventType,
        locale,
        options.templateVariables,
      );
      subject = rendered.subject;
      html = rendered.html;
      text = rendered.text;
    }

    const payload: EmailPayload = {
      to: options.recipientEmail,
      subject,
      html,
      text,
      locale,
      headers: options.customHeaders,
      metadata: {
        eventType: options.eventType,
        referenceCode: options.referenceCode,
      },
    };

    return this.deliver({
      eventType: options.eventType,
      originReferenceCode: options.referenceCode,
      originEntityType: options.originEntityType || 'SYSTEM',
      existingLogId: options.existingLogId,
      payload,
    });
  }

  async deliver(
    notificationTypeOrOptions: PrismaNotificationType | DeliverOptions,
    originReferenceCode?: string,
    originEntityType?: string,
    payload?: EmailPayload,
  ): Promise<boolean> {
    let opts: DeliverOptions;

    if (typeof notificationTypeOrOptions === 'object') {
      opts = notificationTypeOrOptions;
    } else {
      opts = {
        notificationType: notificationTypeOrOptions,
        originReferenceCode: originReferenceCode!,
        originEntityType: originEntityType!,
        payload: payload!,
      };
    }

    const {
      originReferenceCode: refCode,
      originEntityType: entityType,
      payload: emailPayload,
      existingLogId,
    } = opts;

    const prismaType =
      opts.notificationType ||
      (opts.eventType
        ? mapEventToPrismaNotificationType(opts.eventType)
        : PrismaNotificationType.CUSTOMER_ACKNOWLEDGMENT);

    const eventIdentifier = opts.eventType || prismaType;
    const effectiveEntityType = opts.eventType
      ? `${entityType}:${opts.eventType}`.slice(0, 50)
      : entityType;

    // 1. Check suppression list if marketing
    if (
      opts.eventType === EmailEventType.MARKETING_CAMPAIGN &&
      this.suppressionService
    ) {
      const isSuppressed = await this.suppressionService.isSuppressed(
        emailPayload.to,
      );
      if (isSuppressed) {
        this.logger.warn(
          `Skipped marketing email to suppressed recipient: ${redactEmailAddress(emailPayload.to)}`,
        );
        return false;
      }
    }

    // 2. Deterministic Idempotency Key (Immutable business identity: eventType, entity, ref, recipient)
    // NOTE: Subject, language, and template styling do NOT mutate the business idempotency key.
    const idempotencyKey =
      opts.idempotencyKey ||
      emailPayload.idempotencyKey ||
      `dunas-${crypto
        .createHash('sha256')
        .update(
          `${eventIdentifier}:${effectiveEntityType}:${refCode}:${emailPayload.to}`,
        )
        .digest('hex')}`;

    emailPayload.idempotencyKey = idempotencyKey;

    // 3. One delivery record per logical notification / Idempotency Check
    let logRecord: {
      id: string;
      status: PrismaDeliveryStatus;
      attempts: number;
    } | null = null;

    if (this.prisma?.notificationDeliveryLog) {
      try {
        if (existingLogId) {
          logRecord = await this.prisma.notificationDeliveryLog.findUnique({
            where: { id: existingLogId },
            select: { id: true, status: true, attempts: true },
          });
        } else {
          // Check for existing delivery record for this exact logical event & entity
          const existing =
            typeof this.prisma.notificationDeliveryLog.findFirst === 'function'
              ? await this.prisma.notificationDeliveryLog.findFirst({
                  where: {
                    originReferenceCode: refCode,
                    recipientEmail: emailPayload.to,
                    OR: [
                      { originEntityType: effectiveEntityType },
                      {
                        originEntityType: entityType,
                        notificationType: prismaType,
                      },
                    ],
                  },
                  select: {
                    id: true,
                    status: true,
                    attempts: true,
                    lastAttemptAt: true,
                  },
                  orderBy: { createdAt: 'desc' },
                })
              : null;

          if (existing) {
            // If already sent, return true without duplicate send!
            if (existing.status === PrismaDeliveryStatus.SENT) {
              this.logger.log(
                `[IDEMPOTENT SKIP] Notification ${eventIdentifier} for ref ${refCode} to ${redactEmailAddress(emailPayload.to)} was already SENT.`,
              );
              return true;
            }

            // Reuse existing record for retry instead of creating duplicate row
            logRecord = existing;
          } else {
            // Create single new pending record
            logRecord = await this.prisma.notificationDeliveryLog.create({
              data: {
                notificationType: prismaType,
                originReferenceCode: refCode,
                originEntityType: effectiveEntityType,
                recipientEmail: emailPayload.to,
                status: PrismaDeliveryStatus.PENDING,
                attempts: 0,
              },
              select: { id: true, status: true, attempts: true },
            });
          }
        }
      } catch (dbErr: any) {
        this.logger.warn(
          `Could not query/create delivery log record: ${dbErr?.message || dbErr}`,
        );
      }
    }

    // 4. Provider Delivery Attempt
    const currentAttempts = (logRecord?.attempts || 0) + 1;
    let success = false;
    let providerMessageId: string | undefined;
    let failureReason: string | undefined;
    let isTransient = true;

    try {
      const result = await this.providerAdapter.send(emailPayload);
      if (result.status === 'SUCCESS' || (result as any).success === true) {
        success = true;
        providerMessageId =
          result.providerMessageId || (result as any).messageId;
      } else {
        throw new Error(
          result.providerError || 'Provider reported failure without reason',
        );
      }
    } catch (error: unknown) {
      const err = error as Error;
      failureReason = err.message || 'Unknown delivery failure';

      if (error instanceof EmailDeliveryException) {
        isTransient = error.isTransient;
      } else {
        isTransient = true;
      }
    }

    // 5. Update Delivery Log In-Place (NO DUPLICATE LOGS!)
    if (logRecord && this.prisma?.notificationDeliveryLog) {
      try {
        if (success) {
          await this.prisma.notificationDeliveryLog.update({
            where: { id: logRecord.id },
            data: {
              status: PrismaDeliveryStatus.SENT,
              attempts: currentAttempts,
              lastAttemptAt: new Date(),
              providerResponseId: providerMessageId || null,
              failureReason: null,
            },
          });
          this.logger.log(
            `Successfully delivered ${prismaType} [id=${providerMessageId || 'ok'}, recipient=${redactEmailAddress(emailPayload.to)}]`,
          );
        } else {
          const isExhausted =
            currentAttempts >= this.MAX_RETRIES || !isTransient;
          const newStatus = isExhausted
            ? PrismaDeliveryStatus.EXHAUSTED
            : PrismaDeliveryStatus.FAILED;

          await this.prisma.notificationDeliveryLog.update({
            where: { id: logRecord.id },
            data: {
              status: newStatus,
              attempts: currentAttempts,
              lastAttemptAt: new Date(),
              failureReason,
            },
          });

          this.logger.warn(
            `Email delivery attempt ${currentAttempts} failed for ${prismaType} (${isExhausted ? 'EXHAUSTED' : 'FAILED'}, transient=${isTransient}): ${failureReason}`,
          );
        }
      } catch (updateErr: any) {
        this.logger.error(
          `Failed to update delivery log: ${updateErr?.message || updateErr}`,
        );
      }
    }

    return success;
  }

  /**
   * Dispatches a canonical event through the template registry and delivery pipeline
   */
  async dispatchCanonicalEmail(opts: {
    eventType: EmailEventType;
    recipientEmail: string;
    originReferenceCode: string;
    originEntityType: OriginEntityType;
    locale?: SupportedLocale;
    variables: Record<string, any>;
    isInternalRecipient?: boolean;
    existingLogId?: string;
  }): Promise<boolean> {
    if (!this.templateRegistry) {
      throw new Error('TemplateRegistryService is not injected');
    }

    const { subject, html, text, locale } =
      this.templateRegistry.renderTemplate(
        opts.eventType,
        opts.locale || 'en',
        opts.variables,
      );

    const payload: EmailPayload = {
      to: opts.recipientEmail,
      subject,
      html,
      text,
      locale,
      tags: {
        eventType: opts.eventType,
        originReferenceCode: opts.originReferenceCode,
      },
    };

    return this.deliver({
      eventType: opts.eventType,
      notificationType: mapEventToPrismaNotificationType(
        opts.eventType,
        opts.isInternalRecipient,
      ),
      originReferenceCode: opts.originReferenceCode,
      originEntityType: opts.originEntityType,
      payload,
      existingLogId: opts.existingLogId,
    });
  }
}
