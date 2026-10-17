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
import { ConfigService } from '@nestjs/config';
import { renderBookingCustomerConfirmation } from './templates/booking-confirmation.template';
import { renderBookingInternalAlert } from './templates/booking-alert.template';
import { BookingCreatedPayload } from './interfaces/booking-created-payload.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailCompositionService)
    private readonly emailComposition: EmailCompositionService,
    @Inject(EmailDeliveryService)
    private readonly emailDelivery: EmailDeliveryService,
    @Inject(ConfigService) private readonly configService?: ConfigService,
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
      throw new BadRequestException('Only failed notifications can be retried');
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
              lt: new Date(Date.now() - 15 * 1000),
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

      case 'BOOKING': {
        const booking = await this.prisma.booking.findFirst({
          where: { referenceCode: log.originReferenceCode, deletedAt: null },
          include: {
            tour: { select: { titleJsonb: true } },
            billingInfo: true,
            invoice: true,
          },
        });
        if (booking) {
          const tourTitle =
            (booking.tour?.titleJsonb as Record<string, string>)?.en ||
            (booking.tour?.titleJsonb as Record<string, string>)?.ar ||
            'Custom Tour';

          const bookingPayload: BookingCreatedPayload = {
            referenceCode: booking.referenceCode,
            invoiceNumber:
              booking.invoice?.invoiceNumber || booking.referenceCode,
            tourTitle,
            totalAmountUsd: String(booking.totalAmountUsd),
            arrivalDate: booking.arrivalDate,
            customerEmail: booking.billingInfo?.email || log.recipientEmail,
            customerName: booking.billingInfo?.fullName || 'Valued Guest',
            adults: booking.adults,
            children: booking.children,
            infants: booking.infants,
            userId: booking.userId || undefined,
          };

          const adminDashboardUrl =
            this.configService?.get<string>('mail.adminDashboardBaseUrl') ||
            'http://localhost:3000/admin';
          const internalRecipient =
            this.configService?.get<string>('mail.internalAlertRecipient') ||
            'sales@dunastravel.com';

          const payload =
            log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
              ? renderBookingCustomerConfirmation(bookingPayload)
              : renderBookingInternalAlert(
                  bookingPayload,
                  internalRecipient,
                  adminDashboardUrl,
                );

          await this.emailDelivery.deliver(
            log.notificationType as unknown as NotificationType,
            booking.referenceCode,
            'BOOKING',
            payload,
          );
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'USER': {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { id: log.originReferenceCode },
              { email: log.originReferenceCode },
            ],
            deletedAt: null,
          },
          select: { id: true, email: true, name: true },
        });
        if (!user) {
          throw new NotFoundException(
            'User not found for retry reconstruction',
          );
        }
        this.logger.log(`Retrying USER notification for ${user.email}`);
        const payload = {
          to: user.email,
          subject: 'Notification Update',
          html: `<p>Dear ${user.name || 'User'},</p><p>This is a retry of your notification.</p>`,
          text: `Dear ${user.name || 'User'},\nThis is a retry of your notification.`,
        };
        await this.emailDelivery.deliver(
          log.notificationType as unknown as NotificationType,
          user.id,
          'USER',
          payload,
        );
        return { success: true, message: 'Retry completed' };
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
        subject: `${vars['otpCode']} is your Dunas Travel verification code | رمز التحقق الخاص بك`,
        html: `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dunas Travel Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #07060a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f5edd6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #07060a; padding: 35px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #121018; border: 1px solid rgba(201, 162, 39, 0.35); border-radius: 18px; overflow: hidden; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.85);">
          
          <!-- Top Gold Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #996515, #c9a227, #f7e7a0, #c9a227, #996515);"></td>
          </tr>

          <!-- Header / Brand Wordmark -->
          <tr>
            <td align="center" style="padding: 36px 30px 20px 30px; text-align: center;">
              <div style="font-family: 'Georgia', 'Times New Roman', serif; font-size: 24px; font-weight: 700; letter-spacing: 5px; color: #c9a227; text-transform: uppercase; margin-bottom: 4px;">
                DUNAS TRAVEL
              </div>
              <div style="font-size: 10.5px; letter-spacing: 3px; color: #8e8777; text-transform: uppercase; font-weight: 500;">
                Luxury Journeys & Bespoke Experiences
              </div>
              <div style="margin: 18px auto 0 auto; width: 60px; height: 1px; background: linear-gradient(90deg, transparent, rgba(201, 162, 39, 0.6), transparent);"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 10px 35px 30px 35px; text-align: center;">
              <!-- Bilingual Heading -->
              <h1 style="color: #f7e7a0; font-family: 'Georgia', serif; font-size: 22px; font-weight: 600; margin: 0 0 8px 0; letter-spacing: 0.5px;">
                Account & Booking Verification
              </h1>
              <div style="color: #c9a227; font-size: 16px; font-weight: 600; margin-bottom: 22px; font-family: 'Segoe UI', Tahoma, sans-serif;" dir="rtl">
                تفعيل الحساب وتأكيد حجز رحلتك
              </div>

              <!-- Greeting & Instructions -->
              <p style="color: #d1cbbd; font-size: 14.5px; line-height: 1.65; margin: 0 0 10px 0;">
                Dear <strong style="color: #ffffff;">${vars['name']}</strong>, thank you for registering with Dunas Travel. To verify your email and proceed with your luxury booking reservation, please use the 6-digit confirmation code below:
              </p>
              <p style="color: #a8a090; font-size: 13.5px; line-height: 1.65; margin: 0 0 26px 0;" dir="rtl">
                عزيزنا <strong style="color: #f7e7a0;">${vars['name']}</strong>، لتفعيل حسابك وتأكيد حجز رحلتك الفاخرة، يرجى إدخال رمز التحقق التالي:
              </p>

              <!-- Luxury OTP Code Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #1a1724; border: 1px solid rgba(201, 162, 39, 0.4); border-radius: 14px; padding: 18px 24px; display: inline-block; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #f7e7a0; text-shadow: 0 0 15px rgba(201, 162, 39, 0.5); display: inline-block; padding-left: 12px;">
                        ${vars['otpCode']}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Badge -->
              <div style="display: inline-block; background-color: rgba(201, 162, 39, 0.12); border: 1px solid rgba(201, 162, 39, 0.25); border-radius: 20px; padding: 5px 16px; font-size: 12px; color: #c9a227; margin-bottom: 24px;">
                ⏳ Valid for 15 minutes • صالح لمدة 15 دقيقة
              </div>

              <!-- One-Click Button -->
              <div style="margin: 15px 0 28px 0;">
                <a href="${vars['verifyUrl']}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #c9a227 0%, #dfba47 50%, #b88f1a 100%); color: #0a090f; font-size: 13.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; text-decoration: none; padding: 13px 32px; border-radius: 10px; box-shadow: 0 4px 20px rgba(201, 162, 39, 0.35);">
                  Verify Instantly • تفعيل الحساب بنقرة واحدة
                </a>
              </div>

              <!-- Security Notice -->
              <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 10px; padding: 14px 18px; text-align: left; font-size: 12px; color: #8e8777; line-height: 1.5;">
                <div style="color: #c9a227; font-weight: 600; margin-bottom: 4px;">🛡️ Security Notice • تنبيه أمني:</div>
                Never share this verification code with anyone. Dunas Travel staff will never ask for your code. If you did not create an account or request a booking, you can safely disregard this message.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 30px; background-color: #0d0c13; border-top: 1px solid rgba(201, 162, 39, 0.15); text-align: center; font-size: 11px; color: #6e675b; line-height: 1.6;">
              <div style="color: #8e8777; font-weight: 500; margin-bottom: 4px;">
                Dunas Travel Group • Cairo — Headquarters
              </div>
              <div>
                Spain • Italy • Brazil • Mexico • Colombia • Egypt
              </div>
              <div style="margin-top: 8px;">
                <a href="https://www.dunastravel.com" style="color: #c9a227; text-decoration: none;">www.dunastravel.com</a> &nbsp;|&nbsp;
                <a href="mailto:concierge@dunastravel.com" style="color: #c9a227; text-decoration: none;">concierge@dunastravel.com</a>
              </div>
              <div style="margin-top: 10px; color: #524e45;">
                &copy; ${new Date().getFullYear()} Dunas Travel. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
        text: `DUNAS TRAVEL — Account & Booking Verification\n\nDear ${vars['name']},\n\nYour 6-digit verification code to activate your account and complete your booking reservation is:\n\n${vars['otpCode']}\n\nThis code will expire in 15 minutes.\n\nOr verify instantly by clicking this link:\n${vars['verifyUrl']}\n\nSecurity notice: Never share this code with anyone. Dunas Travel will never ask for your code. If you did not request this, please disregard this email.\n\nwww.dunastravel.com`,
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
