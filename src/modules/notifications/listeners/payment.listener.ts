import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PAYMENT_EVENTS } from '../../../common/events/payment-events';

@Injectable()
export class PaymentEventsListener {
  private readonly logger = new Logger(PaymentEventsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(PAYMENT_EVENTS.SUCCEEDED, { async: true })
  async handlePaymentSucceeded(payload: any) {
    this.logger.log(
      `Handling payment succeeded event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
    });

    if (booking && booking.status !== 'PAID') {
      await this.prisma.booking.update({
        where: { id: payload.bookingId },
        data: { status: 'PAID' },
      });
    }

    // Trigger existing Resend email confirmation flow
    // In a real app we might call a mailer service here, or emit a BOOKING_PAID event
    // that the BookingListener handles. For now, we log the intent.
    this.logger.log(
      `Payment confirmed email would be sent to customer for booking ${payload.bookingId}`,
    );
  }

  @OnEvent(PAYMENT_EVENTS.FAILED, { async: true })
  async handlePaymentFailed(payload: any) {
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
  async handlePaymentRefunded(payload: any) {
    this.logger.log(
      `Handling payment refunded event for booking ${payload.bookingId}`,
    );

    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
    });

    if (booking && booking.status !== 'REFUNDED') {
      await this.prisma.booking.update({
        where: { id: payload.bookingId },
        data: { status: 'REFUNDED' },
      });
    }
  }
}
