import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { BOOKING_EVENTS } from '../../../common/events';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import { NotificationType } from '../types';
import { renderBookingCustomerConfirmation } from '../templates/booking-confirmation.template';
import { renderBookingInternalAlert } from '../templates/booking-alert.template';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
} from '@prisma/client';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { TemplateRegistryService } from '../templates/template-registry.service';
import {
  EmailEventType,
  SupportedLocale,
} from '../types/canonical-notification.types';
import {
  formatFinancialAmount,
  redactEmailAddress,
} from '../../../common/utils/currency-formatter.util';

@Injectable()
export class BookingCreatedListener {
  private readonly logger = new Logger(BookingCreatedListener.name);

  constructor(
    private readonly deliveryService: EmailDeliveryService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inAppNotifications: InAppNotificationsService,
    @Optional()
    private readonly templateRegistry?: TemplateRegistryService,
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

      // In-App Notifications
      await this.inAppNotifications.notifyAdmins({
        category: InAppNotificationCategory.BOOKING,
        priority: InAppNotificationPriority.HIGH,
        title: `New Booking #${payload.referenceCode}`,
        message: `Booking #${payload.referenceCode} placed by ${payload.customerName} (${payload.tourTitle})`,
        entityType: 'BOOKING',
        entityId: payload.referenceCode,
        deepLink: '/admin/bookings',
        metadata: {
          referenceCode: payload.referenceCode,
          totalAmount: payload.totalAmountUsd,
        },
      });

      if (payload.userId) {
        await this.inAppNotifications.createNotification({
          userId: payload.userId,
          category: InAppNotificationCategory.BOOKING,
          priority: InAppNotificationPriority.NORMAL,
          title: `Booking #${payload.referenceCode} Received`,
          message: `Your booking for ${payload.tourTitle} has been received and is being processed.`,
          targetApp: 'CUSTOMER',
          entityType: 'BOOKING',
          entityId: payload.referenceCode,
          deepLink: '/account/bookings',
          metadata: { referenceCode: payload.referenceCode },
        });
      }

      this.logger.log(
        `Dispatching booking created notifications for referenceCode: ${payload.referenceCode} to customer (${redactEmailAddress(payload.customerEmail)}) and sales team`,
      );

      await Promise.all([
        this.deliveryService.deliver({
          eventType: EmailEventType.BOOKING_CREATED,
          notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          originReferenceCode: payload.referenceCode,
          originEntityType: 'BOOKING',
          payload: customerPayload,
        }),
        this.deliveryService.deliver({
          eventType: EmailEventType.BOOKING_CREATED,
          notificationType: NotificationType.INTERNAL_SALES_ALERT,
          originReferenceCode: payload.referenceCode,
          originEntityType: 'BOOKING',
          payload: salesPayload,
        }),
      ]);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to process booking.created event: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnEvent(BOOKING_EVENTS.CONFIRMED, { async: true })
  async handleBookingConfirmedEvent(payload: {
    bookingId?: string;
    referenceCode?: string;
    customerEmail?: string;
  }) {
    if (!payload?.referenceCode && !payload?.bookingId) return;

    try {
      const booking = await this.prisma.booking.findFirst({
        where: payload.referenceCode
          ? { referenceCode: payload.referenceCode }
          : { id: payload.bookingId },
        include: { user: true, tour: true, billingInfo: true, invoice: true },
      });

      if (!booking) return;

      const customerEmail =
        booking.billingInfo?.email ||
        booking.user?.email ||
        payload.customerEmail;
      if (!customerEmail) return;

      const customerName =
        booking.billingInfo?.fullName ||
        booking.user?.name ||
        'Valued Traveler';
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
      const travelDate = booking.arrivalDate
        ? new Date(booking.arrivalDate).toLocaleDateString()
        : 'TBD';

      if (this.templateRegistry && this.deliveryService) {
        const rendered = this.templateRegistry.renderTemplate(
          EmailEventType.BOOKING_CONFIRMED,
          locale,
          {
            customerName,
            referenceCode: booking.referenceCode,
            tourTitle,
            formattedAmount,
            travelDate,
            invoiceNumber: booking.invoice?.invoiceNumber || '',
          },
        );

        await this.deliveryService.deliver({
          eventType: EmailEventType.BOOKING_CONFIRMED,
          notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          originReferenceCode: booking.referenceCode,
          originEntityType: 'BOOKING',
          payload: {
            to: customerEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            locale: rendered.locale,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to handle booking.confirmed event: ${err?.message || err}`,
      );
    }
  }

  @OnEvent(BOOKING_EVENTS.CANCELLED, { async: true })
  async handleBookingCancelledEvent(payload: {
    bookingId?: string;
    referenceCode?: string;
    reason?: string;
  }) {
    if (!payload?.referenceCode && !payload?.bookingId) return;

    try {
      const booking = await this.prisma.booking.findFirst({
        where: payload.referenceCode
          ? { referenceCode: payload.referenceCode }
          : { id: payload.bookingId },
        include: { user: true, tour: true, billingInfo: true },
      });

      if (!booking) return;

      const customerEmail = booking.billingInfo?.email || booking.user?.email;
      if (!customerEmail) return;

      const customerName =
        booking.billingInfo?.fullName ||
        booking.user?.name ||
        'Valued Traveler';
      const tourTitle =
        (booking.tour?.titleJsonb as any)?.en ||
        booking.tour?.slug ||
        'Luxury Journey';
      const locale: SupportedLocale =
        (booking.language as SupportedLocale) ||
        (booking.user?.preferredLanguage as SupportedLocale) ||
        'en';

      const wasPaid = Number(booking.paidAmountUsd) > 0;
      const eventType = wasPaid
        ? EmailEventType.BOOKING_CANCELLED_AFTER_PAYMENT
        : EmailEventType.BOOKING_CANCELLED_BEFORE_PAYMENT;

      if (this.templateRegistry && this.deliveryService) {
        const rendered = this.templateRegistry.renderTemplate(
          eventType,
          locale,
          {
            customerName,
            referenceCode: booking.referenceCode,
            tourTitle,
            status: 'CANCELLED',
            reason: payload.reason || 'Booking cancelled',
          },
        );

        await this.deliveryService.deliver({
          eventType,
          notificationType: NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          originReferenceCode: booking.referenceCode,
          originEntityType: 'BOOKING',
          payload: {
            to: customerEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            locale: rendered.locale,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to handle booking.cancelled event: ${err?.message || err}`,
      );
    }
  }
}
