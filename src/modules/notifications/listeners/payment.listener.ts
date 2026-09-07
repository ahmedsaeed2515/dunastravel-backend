import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PAYMENT_EVENTS } from '../../../common/events/payment-events';
import { CommissionsService } from '../../commissions/commissions.service';

import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { InAppNotificationCategory, InAppNotificationPriority } from '@prisma/client';

import { EmailCompositionService } from '../services/email-composition.service';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { NotificationType } from '../types';

interface PaymentEventPayload {
  bookingId: string;
  paymentId?: string;
  amount?: number;
  currency?: string;
  refundId?: string;
  refundAmount?: number;
  reason?: string;
  gateway?: string;
}

@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionsService: CommissionsService,
    private readonly inAppNotifications: InAppNotificationsService,
    private readonly emailComposition: EmailCompositionService,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  @OnEvent(PAYMENT_EVENTS.SUCCEEDED, { async: true })
  async handlePaymentSucceeded(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment succeeded event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        user: true,
        tour: true,
        billingInfo: true,
        passengers: true,
      },
    });

    if (booking) {
      const customerUserId = booking.userId;
      const customerEmail =
        booking.user?.email ||
        booking.billingInfo?.email ||
        undefined;
      const customerName =
        booking.user?.name ||
        booking.billingInfo?.fullName ||
        booking.passengers[0]?.fullName ||
        'Valued Customer';
      const tourTitle =
        (booking.tour?.titleJsonb as any)?.en ||
        booking.tour?.slug ||
        'Tour Package';

      // In-App Notification for Admins
      await this.inAppNotifications.notifyAdmins({
        category: InAppNotificationCategory.PAYMENT,
        priority: InAppNotificationPriority.HIGH,
        title: `Payment Confirmed: #${booking.referenceCode}`,
        message: `Payment of $${booking.totalAmountUsd} confirmed for booking #${booking.referenceCode}`,
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/admin/finance',
        metadata: { bookingId: booking.id, amount: booking.totalAmountUsd },
      });

      if (customerUserId) {
        await this.inAppNotifications.createNotification({
          userId: customerUserId,
          category: InAppNotificationCategory.PAYMENT,
          priority: InAppNotificationPriority.HIGH,
          title: `Payment Received: #${booking.referenceCode}`,
          message: `Your payment of $${booking.totalAmountUsd} for booking #${booking.referenceCode} was successful!`,
          targetApp: 'CUSTOMER',
          entityType: 'BOOKING',
          entityId: booking.referenceCode,
          deepLink: '/account/bookings',
          metadata: { bookingId: booking.id, amount: booking.totalAmountUsd },
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

      // Dispatch emails to Customer and Admin
      const paidAt = new Date();

      if (customerEmail) {
        try {
          const customerEmailPayload = await this.emailComposition.composePaymentConfirmedCustomer({
            customerEmail,
            customerName,
            referenceCode: booking.referenceCode,
            tourTitle,
            amountUsd: Number(booking.totalAmountUsd),
            paidAt,
          });

          await this.emailDelivery.deliver(
            NotificationType.CUSTOMER_ACKNOWLEDGMENT,
            booking.referenceCode,
            'BOOKING',
            customerEmailPayload,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to send customer payment confirmation email: ${msg}`);
        }
      }

      try {
        const adminEmailPayload = await this.emailComposition.composePaymentConfirmedAdmin({
          customerEmail: customerEmail || 'N/A',
          customerName,
          referenceCode: booking.referenceCode,
          tourTitle,
          amountUsd: Number(booking.totalAmountUsd),
          paidAt,
        });

        await this.emailDelivery.deliver(
          NotificationType.INTERNAL_SALES_ALERT,
          booking.referenceCode,
          'BOOKING',
          adminEmailPayload,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to send admin payment alert email: ${msg}`);
      }
    }
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

    try {
      if (booking.userId) {
        await this.inAppNotifications.createNotification({
          userId: booking.userId,
          category: InAppNotificationCategory.PAYMENT,
          priority: InAppNotificationPriority.HIGH,
          title: `Payment Failed: #${booking.referenceCode}`,
          message: 'Your payment could not be processed. Please try again or contact support.',
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
        message: `Payment attempt failed for booking #${booking.referenceCode}: ${payload.reason || 'Provider error'}`,
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/admin/finance',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send payment failure notification: ${msg}`);
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
      },
    });

    if (!booking) return;

    const refundAmount = payload.amount ?? payload.refundAmount ?? 0;

    try {
      if (booking.userId) {
        await this.inAppNotifications.createNotification({
          userId: booking.userId,
          category: InAppNotificationCategory.PAYMENT,
          priority: InAppNotificationPriority.HIGH,
          title: `Refund Processed: #${booking.referenceCode}`,
          message: `Your refund of $${refundAmount} has been processed successfully.`,
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
        message: `A refund of $${refundAmount} was processed for booking #${booking.referenceCode}`,
        entityType: 'BOOKING',
        entityId: booking.referenceCode,
        deepLink: '/admin/finance',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send refund notification: ${msg}`);
    }
  }
}
