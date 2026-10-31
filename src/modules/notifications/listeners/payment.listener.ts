import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PAYMENT_EVENTS } from '../../../common/events/payment-events';
import { CommissionsService } from '../../commissions/commissions.service';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { TemplateRegistryService } from '../templates/template-registry.service';
import {
  EmailEventType,
  SupportedLocale,
} from '../types/canonical-notification.types';
import {
  formatFinancialAmount,
  formatMultiCurrencySummary,
} from '../../../common/utils/currency-formatter.util';

interface PaymentEventPayload {
  bookingId: string;
  paymentId?: string;
  amount?: number | Prisma.Decimal;
  amountUsd?: number | string | Prisma.Decimal;
  currency?: string;
  refundId?: string;
  refundAmount?: number | Prisma.Decimal;
  reason?: string;
  gateway?: string;
  transactionId?: string;
}

@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionsService: CommissionsService,
    private readonly inAppNotifications: InAppNotificationsService,
    private readonly deliveryService: EmailDeliveryService,
    private readonly templateRegistry: TemplateRegistryService,
  ) {}

  @OnEvent(PAYMENT_EVENTS.SUCCEEDED, { async: true })
  async handlePaymentSucceeded(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment succeeded event for booking ${payload.bookingId}`,
    );

    // 1. Authoritative reload from Database (NEVER trust payload amount/currency!)
    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        user: true,
        tour: true,
        billingInfo: true,
        invoice: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      this.logger.error(
        `Authoritative booking not found for payment success: ${payload.bookingId}`,
      );
      return;
    }

    // Authoritative payment lookup
    const payment = payload.paymentId
      ? await this.prisma.payment.findUnique({
          where: { id: payload.paymentId },
        })
      : booking.payments.find((p) => p.status === 'CAPTURED') ||
        booking.payments[0];

    const customerUserId = booking.userId;
    const customerEmail =
      booking.billingInfo?.email || booking.user?.email || undefined;
    const customerName =
      booking.billingInfo?.fullName || booking.user?.name || 'Valued Traveler';
    const tourTitle =
      (booking.tour?.titleJsonb as any)?.en ||
      booking.tour?.slug ||
      'Luxury Journey';

    const locale: SupportedLocale =
      (booking.language as SupportedLocale) ||
      (booking.user?.preferredLanguage as SupportedLocale) ||
      'en';

    // Authoritative currency & amount
    const authoritativeCurrency = (
      payment?.currency ||
      booking.currency ||
      'USD'
    ).toUpperCase();

    const authoritativeAmount = payment?.amount
      ? payment.amount
      : authoritativeCurrency === 'EUR' && booking.originalAmount
        ? booking.originalAmount
        : booking.paidAmountUsd || booking.totalAmountUsd;

    const formattedAmount = formatFinancialAmount(
      authoritativeAmount,
      authoritativeCurrency,
      locale,
    );

    const transactionId =
      payment?.transactionId ||
      payment?.providerPaymentId ||
      payload.transactionId ||
      `TXN-${booking.referenceCode}`;

    const verifiedAt = (payment?.paidAt || new Date()).toUTCString();
    const invoiceNumber = booking.invoice?.invoiceNumber || '';

    // Check USD equivalent if currency is EUR
    const usdEquivalent =
      authoritativeCurrency !== 'USD' && booking.totalAmountUsd
        ? formatFinancialAmount(booking.totalAmountUsd, 'USD', locale)
        : undefined;

    // Check if partial payment
    const isPartialPayment =
      booking.status === 'PARTIALLY_PAID' ||
      (booking.totalAmountUsd &&
        booking.paidAmountUsd &&
        booking.paidAmountUsd.lt(booking.totalAmountUsd));

    // In-App Notifications
    await this.inAppNotifications.notifyAdmins({
      category: InAppNotificationCategory.PAYMENT,
      priority: InAppNotificationPriority.HIGH,
      title: `Payment Confirmed: #${booking.referenceCode}`,
      message: `Payment of ${formattedAmount} confirmed for booking #${booking.referenceCode}`,
      entityType: 'BOOKING',
      entityId: booking.referenceCode,
      deepLink: '/admin/finance',
      metadata: {
        bookingId: booking.id,
        amount: String(authoritativeAmount),
        currency: authoritativeCurrency,
      },
    });

    if (customerUserId) {
      await this.inAppNotifications.createNotification({
        userId: customerUserId,
        category: InAppNotificationCategory.PAYMENT,
        priority: InAppNotificationPriority.HIGH,
        title: `Payment Received: #${booking.referenceCode}`,
        message: `Your payment of ${formattedAmount} for booking #${booking.referenceCode} was successful!`,
        targetApp: 'CUSTOMER',
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/account/bookings',
        metadata: {
          bookingId: booking.id,
          amount: String(authoritativeAmount),
          currency: authoritativeCurrency,
        },
      });
    }

    if (booking.status === 'PAID' || booking.status === 'CONFIRMED') {
      try {
        await this.commissionsService.createCommissionForBooking(
          payload.bookingId,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown commission error';
        this.logger.error(
          `Commission creation failed for paid booking ${payload.bookingId}: ${message}`,
        );
      }
    }

    // Dispatch Emails via Unified Pipeline
    if (customerEmail) {
      if (isPartialPayment) {
        const remainingAmount = booking.totalAmountUsd.minus(
          booking.paidAmountUsd || new Prisma.Decimal(0),
        );
        const formattedRemaining = formatFinancialAmount(
          remainingAmount,
          authoritativeCurrency,
          locale,
        );

        const partialRender = this.templateRegistry.renderTemplate(
          EmailEventType.BOOKING_PARTIALLY_PAID,
          locale,
          {
            customerName,
            referenceCode: booking.referenceCode,
            tourTitle,
            formattedPaidAmount: formattedAmount,
            formattedRemainingAmount: formattedRemaining,
          },
        );

        await this.deliveryService.deliver({
          eventType: EmailEventType.BOOKING_PARTIALLY_PAID,
          notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          originReferenceCode: booking.referenceCode,
          originEntityType: 'BOOKING',
          payload: {
            to: customerEmail,
            subject: partialRender.subject,
            html: partialRender.html,
            text: partialRender.text,
            locale: partialRender.locale,
          },
        });
      } else {
        const receiptRender = this.templateRegistry.renderTemplate(
          EmailEventType.PAYMENT_SUCCEEDED,
          locale,
          {
            customerName,
            referenceCode: booking.referenceCode,
            tourTitle,
            formattedAmount,
            transactionId,
            verifiedAt,
            invoiceNumber,
            currency: authoritativeCurrency,
            usdEquivalent: usdEquivalent || '',
            exchangeRate: booking.exchangeRate
              ? String(booking.exchangeRate)
              : '',
          },
        );

        await this.deliveryService.deliver({
          eventType: EmailEventType.PAYMENT_SUCCEEDED,
          notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          originReferenceCode: booking.referenceCode,
          originEntityType: 'PAYMENT',
          payload: {
            to: customerEmail,
            subject: receiptRender.subject,
            html: receiptRender.html,
            text: receiptRender.text,
            locale: receiptRender.locale,
          },
        });
      }
    }

    // Internal sales alert
    const internalAlertSubject = `[PAYMENT] Booking #${booking.referenceCode} Paid - ${formattedAmount}`;
    const internalSalesEmail =
      process.env.SALES_EMAIL || 'sales@dunastravel.com';

    await this.deliveryService.deliver({
      eventType: EmailEventType.PAYMENT_SUCCEEDED,
      notificationType: NotificationType.INTERNAL_SALES_ALERT,
      originReferenceCode: booking.referenceCode,
      originEntityType: 'PAYMENT',
      payload: {
        to: internalSalesEmail,
        subject: internalAlertSubject,
        html: `<p>Payment of <strong>${formattedAmount}</strong> verified for booking #${booking.referenceCode} (${customerName}).</p>`,
        text: `Payment of ${formattedAmount} verified for booking #${booking.referenceCode} (${customerName}).`,
        locale: 'en',
      },
    });
  }

  @OnEvent(PAYMENT_EVENTS.FAILED, { async: true })
  async handlePaymentFailed(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment failed event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        user: true,
        tour: true,
        billingInfo: true,
      },
    });

    if (!booking) return;

    const customerEmail = booking.billingInfo?.email || booking.user?.email;
    const customerName =
      booking.billingInfo?.fullName || booking.user?.name || 'Valued Traveler';
    const tourTitle =
      (booking.tour?.titleJsonb as any)?.en ||
      booking.tour?.slug ||
      'Luxury Journey';
    const locale: SupportedLocale =
      (booking.language as SupportedLocale) ||
      (booking.user?.preferredLanguage as SupportedLocale) ||
      'en';
    const currency = (booking.currency || 'USD').toUpperCase();
    const amount =
      currency === 'EUR' && booking.originalAmount
        ? booking.originalAmount
        : booking.totalAmountUsd;
    const formattedAmount = formatFinancialAmount(amount, currency, locale);

    const retryUrl = `${process.env.FRONTEND_URL || 'https://dunas-travel.com'}/checkout/${booking.referenceCode}`;
    const safeReason =
      payload.reason || 'Transaction could not be completed by institution';

    // In-App Notification
    if (booking.userId) {
      await this.inAppNotifications.createNotification({
        userId: booking.userId,
        category: InAppNotificationCategory.PAYMENT,
        priority: InAppNotificationPriority.HIGH,
        title: `Payment Failed: #${booking.referenceCode}`,
        message:
          'Your payment could not be processed. Please try again or contact support.',
        targetApp: 'CUSTOMER',
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/account/bookings',
      });
    }

    await this.inAppNotifications.notifyAdmins({
      category: InAppNotificationCategory.PAYMENT,
      priority: InAppNotificationPriority.HIGH,
      title: `Payment Failed: #${booking.referenceCode}`,
      message: `Payment attempt failed for booking #${booking.referenceCode}: ${safeReason}`,
      entityType: 'BOOKING',
      entityId: booking.referenceCode,
      deepLink: '/admin/finance',
    });

    // Customer Email for Payment Failure
    if (customerEmail) {
      const rendered = this.templateRegistry.renderTemplate(
        EmailEventType.PAYMENT_FAILED,
        locale,
        {
          customerName,
          referenceCode: booking.referenceCode,
          tourTitle,
          formattedAmount,
          retryUrl,
          safeReason,
        },
      );

      await this.deliveryService.deliver({
        eventType: EmailEventType.PAYMENT_FAILED,
        notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
        originReferenceCode: booking.referenceCode,
        originEntityType: 'PAYMENT',
        payload: {
          to: customerEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          locale: rendered.locale,
        },
      });
    }
  }

  @OnEvent(PAYMENT_EVENTS.REFUNDED, { async: true })
  async handlePaymentRefunded(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment refunded event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        user: true,
        tour: true,
        billingInfo: true,
        payments: {
          include: { refunds: true },
        },
      },
    });

    if (!booking) return;

    // Authoritative refund lookup from DB
    const latestRefund = booking.payments
      .flatMap((p) => p.refunds || [])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    const customerEmail = booking.billingInfo?.email || booking.user?.email;
    const customerName =
      booking.billingInfo?.fullName || booking.user?.name || 'Valued Traveler';
    const tourTitle =
      (booking.tour?.titleJsonb as any)?.en ||
      booking.tour?.slug ||
      'Luxury Journey';
    const locale: SupportedLocale =
      (booking.language as SupportedLocale) ||
      (booking.user?.preferredLanguage as SupportedLocale) ||
      'en';

    const refundCurrency = (
      latestRefund?.currency ||
      booking.currency ||
      'USD'
    ).toUpperCase();

    const authoritativeRefundAmount =
      latestRefund?.amount ||
      payload.refundAmount ||
      payload.amount ||
      booking.paidAmountUsd;

    const formattedRefundAmount = formatFinancialAmount(
      authoritativeRefundAmount,
      refundCurrency,
      locale,
    );

    const isPartialRefund =
      booking.status !== 'REFUNDED' &&
      booking.paidAmountUsd &&
      booking.paidAmountUsd.gt(0);

    const eventType = isPartialRefund
      ? EmailEventType.PARTIAL_REFUND_COMPLETED
      : EmailEventType.REFUND_COMPLETED;

    const refundRef =
      latestRefund?.providerRefundId ||
      latestRefund?.id ||
      payload.refundId ||
      `REF-${booking.referenceCode}`;

    // In-App Notifications
    if (booking.userId) {
      await this.inAppNotifications.createNotification({
        userId: booking.userId,
        category: InAppNotificationCategory.PAYMENT,
        priority: InAppNotificationPriority.HIGH,
        title: `Refund Processed: #${booking.referenceCode}`,
        message: `Your refund of ${formattedRefundAmount} has been processed successfully.`,
        targetApp: 'CUSTOMER',
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/account/bookings',
      });
    }

    await this.inAppNotifications.notifyAdmins({
      category: InAppNotificationCategory.PAYMENT,
      priority: InAppNotificationPriority.HIGH,
      title: `Refund Processed: #${booking.referenceCode}`,
      message: `A refund of ${formattedRefundAmount} was processed for booking #${booking.referenceCode}`,
      entityType: 'BOOKING',
      entityId: booking.referenceCode,
      deepLink: '/admin/finance',
    });

    // Customer Refund Confirmation Email
    if (customerEmail) {
      const rendered = this.templateRegistry.renderTemplate(eventType, locale, {
        customerName,
        referenceCode: booking.referenceCode,
        tourTitle,
        formattedRefundAmount,
        refundReference: refundRef,
        refundReason:
          latestRefund?.reason || payload.reason || 'Itinerary refund',
      });

      await this.deliveryService.deliver({
        eventType,
        notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
        originReferenceCode: booking.referenceCode,
        originEntityType: 'PAYMENT',
        payload: {
          to: customerEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          locale: rendered.locale,
        },
      });
    }
  }
}
