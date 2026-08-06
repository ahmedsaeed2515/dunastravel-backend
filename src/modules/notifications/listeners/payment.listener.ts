import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PAYMENT_EVENTS } from '../../../common/events/payment-events';
import { CommissionsService } from '../../commissions/commissions.service';

interface PaymentEventPayload {
  bookingId: string;
}

@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionsService: CommissionsService,
  ) {}

  @OnEvent(PAYMENT_EVENTS.SUCCEEDED, { async: true })
  async handlePaymentSucceeded(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment succeeded event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
    });

    if (booking?.status === 'PAID') {
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
        await this.prisma.auditLog.create({
          data: {
            action: 'COMMISSION_CREATION_REQUIRES_RECONCILIATION',
            entityType: 'Booking',
            entityId: payload.bookingId,
            metadata: { error: 'Commission creation failed' },
          },
        });
      }
    }

    // Trigger existing Resend email confirmation flow
    // In a real app we might call a mailer service here, or emit a BOOKING_PAID event
    // that the BookingListener handles. For now, we log the intent.
    this.logger.log(
      `Payment confirmed email would be sent to customer for booking ${payload.bookingId}`,
    );
  }

  @OnEvent(PAYMENT_EVENTS.FAILED, { async: true })
  async handlePaymentFailed(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment failed event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
    });

    // We don't want to override if it's already paid or cancelled etc., maybe only if PENDING
    if (booking && booking.status === 'PENDING') {
      // In this system, payment failure might not cancel the booking entirely, but could mark it as FAILED or remain PENDING
      // We will just log it or update a payment_failed flag if we had one.
      // Let's not mutate booking status aggressively on failure, but we notify.
      this.logger.log(
        `Payment failed notification would be sent to customer for booking ${payload.bookingId}`,
      );
    }
  }

  @OnEvent(PAYMENT_EVENTS.REFUNDED, { async: true })
  async handlePaymentRefunded(payload: PaymentEventPayload) {
    this.logger.log(
      `Handling payment refunded event for booking ${payload.bookingId}`,
    );

    // Financial state is committed by PaymentsService. Listeners must not
    // overwrite authoritative booking/payment state.
  }
}
