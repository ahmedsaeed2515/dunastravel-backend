import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDeliveryLogQueryFilters } from './dto/notification.dto';
import { NotificationDeliveryStatus, Prisma } from '@prisma/client';
import { NotificationType } from './types';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailCompositionService) private readonly emailComposition: EmailCompositionService,
    @Inject(EmailDeliveryService) private readonly emailDelivery: EmailDeliveryService,
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

    const where: Prisma.NotificationDeliveryLogWhereInput = {};
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

    if (
      log.status !== NotificationDeliveryStatus.FAILED &&
      log.status !== NotificationDeliveryStatus.EXHAUSTED
    ) {
      throw new BadRequestException(
        'Only failed notifications can be retried',
      );
    }

    const claim = await this.prisma.notificationDeliveryLog.updateMany({
      where: {
        id,
        status: {
          in: [
            NotificationDeliveryStatus.FAILED,
            NotificationDeliveryStatus.EXHAUSTED,
          ],
        },
        attempts: { lt: 10 },
        OR: [
          { lastAttemptAt: null },
          {
            lastAttemptAt: {
              lt: new Date(Date.now() - 5 * 60 * 1000),
            },
          },
        ],
      },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        failureReason: 'Manual retry requested',
      },
    });
    if (claim.count !== 1) {
      throw new ConflictException(
        'Notification retry is cooling down or exhausted',
      );
    }

    this.logger.log(`Retrying failed notification log ${id}`);

    switch (log.originEntityType) {
      case 'INQUIRY': {
        const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (inquiry) {
          const inquiryPayload = {
            referenceCode: inquiry.referenceCode,
            fullName: inquiry.fullName,
            email: inquiry.email,
            phone: inquiry.phone,
            preferredLanguage: inquiry.preferredLanguage,
            destinations: inquiry.destinations,
            startDate: inquiry.startDate
              ? inquiry.startDate.toISOString()
              : null,
            endDate: inquiry.endDate ? inquiry.endDate.toISOString() : null,
            adults: inquiry.adults,
            children: inquiry.children,
            budgetAmountUsd: inquiry.budgetAmount
              ? Number(inquiry.budgetAmount)
              : null,
            notes: inquiry.notes,
            createdAt: inquiry.createdAt.toISOString(),
          };

          const payload =
            log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
              ? await this.emailComposition.composeInquiryCustomerAcknowledgment(
                  inquiryPayload as unknown as Parameters<
                    EmailCompositionService['composeInquiryCustomerAcknowledgment']
                  >[0],
                )
              : await this.emailComposition.composeInquiryInternalAlert(
                  inquiryPayload as unknown as Parameters<
                    EmailCompositionService['composeInquiryInternalAlert']
                  >[0],
                );

          await this.emailDelivery.deliver(
            log.notificationType as unknown as NotificationType,
            inquiry.referenceCode,
            'INQUIRY',
            payload,
          );
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'CONTACT': {
        const contact = await this.prisma.contactSubmission.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (contact) {
          const contactEvent = {
            submissionId: contact.id,
            referenceCode: contact.referenceCode,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone || undefined,
            subject: contact.subject,
            message: contact.message,
            locale: contact.locale,
            ipAddress: contact.ipAddress || undefined,
            submittedAt: contact.createdAt,
          };

          const payload =
            log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
              ? await this.emailComposition.composeContactCustomerAcknowledgment(
                  contactEvent,
                )
              : await this.emailComposition.composeContactInternalAlert(
                  contactEvent,
                );

          await this.emailDelivery.deliver(
            log.notificationType as unknown as NotificationType,
            contact.referenceCode,
            'CONTACT',
            payload,
          );
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

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
    otpCode: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&code=${otpCode}`;

    const template = await this.emailComposition.getTemplateFromDb(
      'user_verification',
      { name, otpCode, verifyUrl },
      (vars: Record<string, string>) => ({
        subject: 'Your Dunas Travel Verification Code',
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 1px solid rgba(201, 162, 39, 0.3); border-radius: 16px; background-color: #121118; color: #f5edd6; text-align: center;">
            <h2 style="color: #c9a227; margin-bottom: 8px; font-size: 24px;">Verify Your Account</h2>
            <p style="color: #d1cbbd; font-size: 15px; margin-bottom: 24px;">Hi ${vars['name']}, thank you for registering with Dunas Travel. Please use the 6-digit verification code below to complete your registration:</p>
            <div style="margin: 28px 0;">
              <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #0a0a0d; background: linear-gradient(135deg, #c9a227, #f0d575); padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 20px rgba(201, 162, 39, 0.25);">
                ${vars['otpCode']}
              </span>
            </div>
            <p style="color: #a0998a; font-size: 13px; margin-top: 20px;">This code will expire in 15 minutes.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-t: 1px solid rgba(201, 162, 39, 0.15); font-size: 13px; color: #8e8777;">
              Or verify directly via link: <a href="${vars['verifyUrl']}" style="color: #c9a227; text-decoration: underline;">Click Here to Verify</a>
            </div>
          </div>
        `,
        text: `Hi ${vars['name']},\n\nYour 6-digit verification code for Dunas Travel is: ${vars['otpCode']}\nThis code will expire in 15 minutes.\n\nDirect verification link: ${vars['verifyUrl']}`,
      }),
    );

    const payload = {
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: NotificationType.USER_VERIFICATION },
    };

    const delivered = await this.emailDelivery.deliver(
      NotificationType.USER_VERIFICATION,
      'AUTH',
      'USER',
      payload,
    );
    if (!delivered) {
      throw new ServiceUnavailableException(
        'Verification email could not be delivered. Please try again later.',
      );
    }
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
      (vars: Record<string, string>) => ({
        subject: 'Reset your Dunas Travel Password',
        html: `<p>Hi ${vars['name']}</p><p>You requested a password reset. Click the link below to set a new password:</p><p><a href="${vars['resetUrl']}">${vars['resetUrl']}</a></p><p>If you did not request this, please ignore this email.</p>`,
        text: `Hi ${vars['name']},\n\nYou requested a password reset. Use this link: ${vars['resetUrl']}`,
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
      .catch(() => this.logger.error('Send password reset email failed'));
  }
}
