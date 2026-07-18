import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDeliveryLogQueryFilters } from './dto/notification.dto';
import { NotificationDeliveryStatus } from '@prisma/client';
import { NotificationType } from './types';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailComposition: EmailCompositionService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAllLogs(filters: NotificationDeliveryLogQueryFilters) {
    const {
      page = 1,
      limit = 10,
      status,
      notificationType,
      recipientEmail,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (notificationType) where.notificationType = notificationType;
    if (recipientEmail)
      where.recipientEmail = { contains: recipientEmail, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationDeliveryLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMetrics() {
    const totalSent = await this.prisma.notificationDeliveryLog.count({
      where: { status: NotificationDeliveryStatus.SENT },
    });
    const totalFailed = await this.prisma.notificationDeliveryLog.count({
      where: {
        status: {
          in: [
            NotificationDeliveryStatus.FAILED,
            NotificationDeliveryStatus.EXHAUSTED,
          ],
        },
      },
    });
    const totalPending = await this.prisma.notificationDeliveryLog.count({
      where: { status: NotificationDeliveryStatus.PENDING },
    });

    const total = totalSent + totalFailed + totalPending;
    const successRate = total > 0 ? (totalSent / total) * 100 : 0;

    return {
      totalSent,
      totalFailed,
      totalPending,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  async retryNotification(id: string) {
    const log = await this.prisma.notificationDeliveryLog.findUnique({
      where: { id },
    });
    if (!log) throw new NotFoundException('Notification log not found');

    if (log.status === NotificationDeliveryStatus.SENT) {
      throw new BadRequestException(
        'Notification was already sent successfully',
      );
    }

    // Reconstruct payload based on entity type to retry
    // In a full production system, we would serialize the exact payload to S3 or a DB blob.
    // For now, we will re-emit the domain event, which will trigger the listener and start fresh,
    // OR we can manually fetch the entity and re-compose.
    // The safest architectural way is to fetch the entity and manually call the services,
    // but to avoid massive switch-case, we can just reset the log status to PENDING and trigger
    // a background job. Here, we'll implement a simple switch for the supported types.

    this.logger.log(
      `Retrying notification ${id} for ${log.originEntityType} ${log.originReferenceCode}`,
    );

    switch (log.originEntityType) {
      case 'INQUIRY':
        const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (inquiry) {
          const payload =
            log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
              ? await this.emailComposition.composeInquiryCustomerAcknowledgment(
                  inquiry as any,
                )
              : await this.emailComposition.composeInquiryInternalAlert(
                  inquiry as any,
                );

          // Deliver will create a NEW log entry since it doesn't take log ID.
          // To avoid duplicates, we would typically update the existing log, but
          // since EmailDeliveryService creates a new one, we will just call it and mark this one as EXHAUSTED/REPLACED.
          await this.prisma.notificationDeliveryLog.update({
            where: { id: log.id },
            data: { failureReason: 'Retried manually (new log created)' },
          });

          // Fire and forget
          this.emailDelivery
            .deliver(
              log.notificationType as any,
              inquiry.referenceCode,
              'INQUIRY',
              payload,
            )
            .catch((e) => console.error(e));
          return { success: true, message: 'Retry initiated' };
        }
        break;

      case 'CONTACT':
        const contact = await this.prisma.contactSubmission.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (contact) {
          const payload =
            log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
              ? await this.emailComposition.composeContactCustomerAcknowledgment(
                  contact as any,
                )
              : await this.emailComposition.composeContactInternalAlert(
                  contact as any,
                );

          await this.prisma.notificationDeliveryLog.update({
            where: { id: log.id },
            data: { failureReason: 'Retried manually (new log created)' },
          });

          this.emailDelivery
            .deliver(
              log.notificationType as any,
              contact.referenceCode,
              'CONTACT',
              payload,
            )
            .catch((e) => console.error(e));
          return { success: true, message: 'Retry initiated' };
        }
        break;

      default:
        throw new BadRequestException(
          'Automatic retry not supported for this entity type yet',
        );
    }

    throw new NotFoundException(
      'Origin entity not found for retry reconstruction',
    );
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    const template = await this.emailComposition.getTemplateFromDb(
      'user_verification',
      { name, verifyUrl },
      (vars) => ({
        subject: 'Verify your Dunas Travel Account',
        html: `<p>Hi ${vars.name},</p><p>Please verify your email by clicking the link below:</p><p><a href="${vars.verifyUrl}">${vars.verifyUrl}</a></p>`,
        text: `Hi ${vars.name},\n\nPlease verify your email using this link: ${vars.verifyUrl}`,
      }),
    );

    const payload = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: NotificationType.USER_VERIFICATION },
    };

    this.emailDelivery
      .deliver(NotificationType.USER_VERIFICATION, 'AUTH', 'USER', payload)
      .catch((e) => this.logger.error(e));
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const template = await this.emailComposition.getTemplateFromDb(
      'password_reset',
      { name, resetUrl },
      (vars) => ({
        subject: 'Reset your Dunas Travel Password',
        html: `<p>Hi ${vars.name},</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${vars.resetUrl}">${vars.resetUrl}</a></p><p>If you did not request this, please ignore this email.</p>`,
        text: `Hi ${vars.name},\n\nYou requested a password reset. Use this link: ${vars.resetUrl}`,
      }),
    );

    const payload = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: NotificationType.PASSWORD_RESET },
    };

    this.emailDelivery
      .deliver(NotificationType.PASSWORD_RESET, 'AUTH', 'USER', payload)
      .catch((e) => this.logger.error(e));
  }
}
