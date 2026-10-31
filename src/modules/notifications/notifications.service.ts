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
import {
  NotificationDeliveryStatus,
  Prisma,
  NotificationType,
} from '@prisma/client';
import { EmailCompositionService } from './services/email-composition.service';
import { EmailDeliveryService } from './services/email-delivery.service';
import { ConfigService } from '@nestjs/config';
import { TemplateRegistryService } from './templates/template-registry.service';
import {
  EmailEventType,
  SupportedLocale,
} from './types/canonical-notification.types';
import {
  formatFinancialAmount,
  redactEmailAddress,
} from '../../common/utils/currency-formatter.util';

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
    private readonly templateRegistry?: TemplateRegistryService,
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
    if (recipientEmail) {
      where.recipientEmail = { contains: recipientEmail, mode: 'insensitive' };
    }

    const [rawLogs, total] = await Promise.all([
      this.prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notificationDeliveryLog.count({ where }),
    ]);

    // Redact recipient emails for dashboard privacy and annotate real notification type
    const data = rawLogs.map((log) => {
      const realType = this.deriveRealNotificationType(log);
      return {
        ...log,
        realNotificationType: realType,
        recipientEmailRedacted: redactEmailAddress(log.recipientEmail),
      };
    });

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
    const [totalSent, totalFailed, totalExhausted, totalPending] =
      await Promise.all([
        this.prisma.notificationDeliveryLog.count({
          where: { status: NotificationDeliveryStatus.SENT },
        }),
        this.prisma.notificationDeliveryLog.count({
          where: { status: NotificationDeliveryStatus.FAILED },
        }),
        this.prisma.notificationDeliveryLog.count({
          where: { status: NotificationDeliveryStatus.EXHAUSTED },
        }),
        this.prisma.notificationDeliveryLog.count({
          where: { status: NotificationDeliveryStatus.PENDING },
        }),
      ]);

    const totalSkipped = await this.prisma.notificationDeliveryLog.count({
      where: { failureReason: { startsWith: 'SKIPPED' } },
    });

    const total = totalSent + totalFailed + totalExhausted + totalPending;
    const successRate = total > 0 ? (totalSent / total) * 100 : 0;

    return {
      totalSent,
      totalFailed,
      totalExhausted,
      totalPending,
      totalSkipped,
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

    // Safe concurrent claim on existing log
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
      },
      data: {
        lastAttemptAt: new Date(),
        failureReason: 'Manual retry initiated',
      },
    });

    if (claim.count !== 1) {
      throw new ConflictException(
        'Notification retry is cooling down or exhausted',
      );
    }

    this.logger.log(`Retrying failed notification log ${id} in-place`);

    // Authoritative reconstruction based on origin entity
    const baseEntityType = (
      log.originEntityType.includes(':')
        ? log.originEntityType.split(':')[0]
        : log.originEntityType
    ).toUpperCase();
    switch (baseEntityType) {
      case 'INQUIRY': {
        const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (inquiry) {
          const payload =
            log.notificationType === NotificationType.CUSTOMER_ACKNOWLEDGMENT
              ? await this.emailComposition.composeInquiryCustomerAcknowledgment(
                  {
                    referenceCode: inquiry.referenceCode,
                    fullName: inquiry.fullName,
                    email: inquiry.email,
                    phone: inquiry.phone,
                    preferredLanguage: inquiry.preferredLanguage,
                    destinations: inquiry.destinations,
                    startDate: inquiry.startDate
                      ? inquiry.startDate.toISOString()
                      : null,
                    endDate: inquiry.endDate
                      ? inquiry.endDate.toISOString()
                      : null,
                    adults: inquiry.adults,
                    children: inquiry.children,
                    budgetAmount: inquiry.budgetAmount
                      ? String(inquiry.budgetAmount)
                      : null,
                    budgetCurrency: (inquiry as any).budgetCurrency || null,
                    notes: inquiry.notes || null,
                    createdAt: inquiry.createdAt.toISOString(),
                  },
                  (inquiry.preferredLanguage as SupportedLocale) || 'en',
                )
              : await this.emailComposition.composeInquiryInternalAlert({
                  referenceCode: inquiry.referenceCode,
                  fullName: inquiry.fullName,
                  email: inquiry.email,
                  phone: inquiry.phone,
                  preferredLanguage: inquiry.preferredLanguage,
                  destinations: inquiry.destinations,
                  startDate: inquiry.startDate
                    ? inquiry.startDate.toISOString()
                    : null,
                  endDate: inquiry.endDate
                    ? inquiry.endDate.toISOString()
                    : null,
                  adults: inquiry.adults,
                  children: inquiry.children,
                  budgetAmount: inquiry.budgetAmount
                    ? String(inquiry.budgetAmount)
                    : null,
                  budgetCurrency: (inquiry as any).budgetCurrency || null,
                  notes: inquiry.notes || null,
                  createdAt: inquiry.createdAt.toISOString(),
                });

          await this.emailDelivery.deliver({
            existingLogId: log.id,
            notificationType: log.notificationType,
            originReferenceCode: inquiry.referenceCode,
            originEntityType: 'INQUIRY',
            payload,
          });
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'CONTACT':
      case 'CONTACT_SUBMISSION': {
        const contact = await this.prisma.contactSubmission.findUnique({
          where: { referenceCode: log.originReferenceCode },
        });
        if (contact) {
          const payload =
            log.notificationType === NotificationType.CUSTOMER_ACKNOWLEDGMENT
              ? await this.emailComposition.composeContactCustomerAcknowledgment(
                  {
                    referenceCode: contact.referenceCode,
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    email: contact.email,
                    phone: contact.phone || undefined,
                    subject: contact.subject,
                    message: contact.message,
                    locale: contact.locale || 'en',
                    submittedAt: contact.createdAt,
                  },
                  (contact.locale as SupportedLocale) || 'en',
                )
              : await this.emailComposition.composeContactInternalAlert({
                  referenceCode: contact.referenceCode,
                  firstName: contact.firstName,
                  lastName: contact.lastName,
                  email: contact.email,
                  phone: contact.phone || undefined,
                  subject: contact.subject,
                  message: contact.message,
                  locale: contact.locale || 'en',
                  submittedAt: contact.createdAt,
                });

          await this.emailDelivery.deliver({
            existingLogId: log.id,
            notificationType: log.notificationType,
            originReferenceCode: contact.referenceCode,
            originEntityType: 'CONTACT',
            payload,
          });
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'BOOKING': {
        const booking = await this.prisma.booking.findUnique({
          where: { referenceCode: log.originReferenceCode },
          include: { user: true, tour: true, billingInfo: true, invoice: true },
        });
        if (booking) {
          const locale: SupportedLocale =
            (booking.language as SupportedLocale) ||
            (booking.user?.preferredLanguage as SupportedLocale) ||
            'en';
          const currency = (booking.currency || 'USD').toUpperCase();
          const amount =
            currency === 'EUR' && booking.originalAmount
              ? booking.originalAmount
              : booking.totalAmountUsd;
          const formattedAmount = formatFinancialAmount(
            amount,
            currency,
            locale,
          );
          const travelDate = booking.arrivalDate
            ? new Date(booking.arrivalDate).toLocaleDateString()
            : 'TBD';

          const tplRegistry =
            this.templateRegistry ||
            this.emailComposition.getTemplateRegistry();

          const rendered = tplRegistry.renderTemplate(
            booking.status === 'CONFIRMED' || booking.status === 'PAID'
              ? EmailEventType.BOOKING_CONFIRMED
              : EmailEventType.BOOKING_CREATED,
            locale,
            {
              customerName:
                booking.billingInfo?.fullName ||
                booking.user?.name ||
                'Valued Traveler',
              referenceCode: booking.referenceCode,
              tourTitle:
                (booking.tour?.titleJsonb as any)?.en ||
                booking.tour?.slug ||
                'Luxury Journey',
              formattedAmount,
              travelDate,
              invoiceNumber: booking.invoice?.invoiceNumber || '',
            },
          );

          await this.emailDelivery.deliver({
            existingLogId: log.id,
            notificationType: log.notificationType,
            originReferenceCode: booking.referenceCode,
            originEntityType: 'BOOKING',
            payload: {
              to: log.recipientEmail,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              locale: rendered.locale,
            },
          });
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'PAYMENT': {
        const booking = await this.prisma.booking.findFirst({
          where: { referenceCode: log.originReferenceCode },
          include: {
            user: true,
            tour: true,
            billingInfo: true,
            invoice: true,
            payments: true,
          },
        });
        if (booking) {
          const locale: SupportedLocale =
            (booking.language as SupportedLocale) ||
            (booking.user?.preferredLanguage as SupportedLocale) ||
            'en';
          const currency = (booking.currency || 'USD').toUpperCase();
          const amount =
            currency === 'EUR' && booking.originalAmount
              ? booking.originalAmount
              : booking.paidAmountUsd || booking.totalAmountUsd;
          const formattedAmount = formatFinancialAmount(
            amount,
            currency,
            locale,
          );

          const tplRegistry =
            this.templateRegistry ||
            this.emailComposition.getTemplateRegistry();

          const rendered = tplRegistry.renderTemplate(
            EmailEventType.PAYMENT_SUCCEEDED,
            locale,
            {
              customerName:
                booking.billingInfo?.fullName ||
                booking.user?.name ||
                'Valued Traveler',
              referenceCode: booking.referenceCode,
              tourTitle:
                (booking.tour?.titleJsonb as any)?.en ||
                booking.tour?.slug ||
                'Luxury Journey',
              formattedAmount,
              transactionId: `TXN-${booking.referenceCode}`,
              verifiedAt: new Date().toUTCString(),
              invoiceNumber: booking.invoice?.invoiceNumber || '',
              currency,
              usdEquivalent: '',
              exchangeRate: '',
            },
          );

          await this.emailDelivery.deliver({
            existingLogId: log.id,
            notificationType: log.notificationType,
            originReferenceCode: booking.referenceCode,
            originEntityType: 'PAYMENT',
            payload: {
              to: log.recipientEmail,
              subject: rendered.subject,
              html: rendered.html,
              text: rendered.text,
              locale: rendered.locale,
            },
          });
          return { success: true, message: 'Retry completed' };
        }
        break;
      }

      case 'USER':
      case 'AUTH': {
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { id: log.originReferenceCode },
              { email: log.recipientEmail },
            ],
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            preferredLanguage: true,
          },
        });
        if (!user) {
          throw new NotFoundException(
            'User not found for retry reconstruction',
          );
        }

        const payload = {
          to: user.email,
          subject: 'Notification Update — Dunas Travel',
          html: `<p>Dear ${user.name || 'Valued Guest'},</p><p>This is a re-sent notification regarding your account.</p>`,
          text: `Dear ${user.name || 'Valued Guest'},\nThis is a re-sent notification regarding your account.`,
        };

        await this.emailDelivery.deliver({
          existingLogId: log.id,
          notificationType: log.notificationType,
          originReferenceCode: user.id,
          originEntityType: 'USER',
          payload,
        });
        return { success: true, message: 'Retry completed' };
      }

      default: {
        const genericPayload = {
          to: log.recipientEmail,
          subject: 'Notification Update — Dunas Travel',
          html: `<p>Dear Client,</p><p>This is a retry of your notification.</p>`,
          text: `Dear Client,\nThis is a retry of your notification.`,
        };

        await this.emailDelivery.deliver({
          existingLogId: log.id,
          notificationType: log.notificationType,
          originReferenceCode: log.originReferenceCode,
          originEntityType: log.originEntityType,
          payload: genericPayload,
        });
        return { success: true, message: 'Retry completed' };
      }
    }

    throw new NotFoundException(
      'Origin entity not found for retry reconstruction',
    );
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    otpCode: string,
    locale: SupportedLocale = 'en',
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'https://dunas-travel.com';
    const verifyUrl = `${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&code=${otpCode}`;

    const tplRegistry =
      this.templateRegistry || this.emailComposition.getTemplateRegistry();

    const rendered = tplRegistry.renderTemplate(
      EmailEventType.EMAIL_VERIFICATION,
      locale,
      {
        name,
        otpCode,
        verifyUrl,
        email,
      },
    );

    const payload = {
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: rendered.locale,
      tags: { notificationType: NotificationType.USER_VERIFICATION },
    };

    const delivered = await this.emailDelivery.deliver({
      eventType: EmailEventType.EMAIL_VERIFICATION,
      notificationType: NotificationType.USER_VERIFICATION,
      originReferenceCode: 'AUTH',
      originEntityType: 'USER',
      payload,
    });

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
    locale: SupportedLocale = 'en',
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'https://dunas-travel.com';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const tplRegistry =
      this.templateRegistry || this.emailComposition.getTemplateRegistry();

    const rendered = tplRegistry.renderTemplate(
      EmailEventType.PASSWORD_RESET_REQUEST,
      locale,
      {
        name,
        resetUrl,
        email,
      },
    );

    const payload = {
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: rendered.locale,
      tags: { notificationType: NotificationType.PASSWORD_RESET },
    };

    this.emailDelivery
      .deliver({
        eventType: EmailEventType.PASSWORD_RESET_REQUEST,
        notificationType: NotificationType.PASSWORD_RESET,
        originReferenceCode: 'AUTH',
        originEntityType: 'USER',
        payload,
      })
      .catch((err) =>
        this.logger.error(
          `Send password reset email delivery failed: ${err?.message || err}`,
        ),
      );
  }

  private deriveRealNotificationType(log: {
    notificationType: NotificationType;
    originEntityType: string;
    originReferenceCode: string;
  }): string {
    const entity = log.originEntityType.toUpperCase();
    if (entity === 'BOOKING') {
      return log.notificationType === NotificationType.INTERNAL_SALES_ALERT
        ? 'BOOKING_INTERNAL_ALERT'
        : 'BOOKING_CUSTOMER_NOTICE';
    }
    if (entity === 'PAYMENT') {
      return 'PAYMENT_RECEIPT';
    }
    if (entity === 'INQUIRY') {
      return 'INQUIRY_COMMUNICATION';
    }
    if (entity === 'CONTACT' || entity === 'CONTACT_SUBMISSION') {
      return 'CONTACT_COMMUNICATION';
    }
    if (log.notificationType === NotificationType.USER_VERIFICATION) {
      return 'USER_VERIFICATION';
    }
    if (log.notificationType === NotificationType.PASSWORD_RESET) {
      return 'PASSWORD_RESET';
    }
    return log.notificationType;
  }
}
