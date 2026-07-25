import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_EVENTS } from '../../common/events/payment-events';
import { Money } from '../../common/domain/value-objects/money.vo';
import { PaymentEntity } from './domain/payment.entity';
import crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // Sessions expire after 30 minutes — keep in sync with PaymentCronService threshold
  private static readonly SESSION_TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IPaymentGatewayPort)
    private readonly paymentGateway: IPaymentGatewayPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initiatePayment(
    bookingId: string,
    userId?: string,
    guestToken?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tour: true, invoice: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Ownership verification
    let isAuthorized = false;
    if (userId && booking.userId === userId) {
      isAuthorized = true;
    } else if (guestToken && booking.guestTokenHash) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      if (
        crypto.timingSafeEqual(
          Buffer.from(tokenHash),
          Buffer.from(booking.guestTokenHash),
        )
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Mask foreign/unauthorized booking as 404 Not Found to prevent leaking existence
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(
        `Booking is in ${booking.status} status and cannot be paid.`,
      );
    }

    // ─── Idempotency gate ────────────────────────────────────────────────────
    const existingPendingPayment = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'PENDING', isRefund: false },
    });

    if (existingPendingPayment) {
      const ageMs = Date.now() - existingPendingPayment.createdAt.getTime();

      if (ageMs < PaymentsService.SESSION_TTL_MS) {
        if (existingPendingPayment.sessionUrl) {
          this.logger.log(
            `Duplicate initiatePayment for booking ${bookingId}: returning existing session ` +
              `${existingPendingPayment.transactionId} (age ${Math.round(ageMs / 1000)}s)`,
          );
          return {
            url: existingPendingPayment.sessionUrl,
            transactionId: existingPendingPayment.transactionId,
          };
        }
        this.logger.warn(
          `PENDING Payment ${existingPendingPayment.id} for booking ${bookingId} has no sessionUrl stored. Creating a new session.`,
        );
      } else {
        this.logger.log(
          `PENDING Payment ${existingPendingPayment.id} for booking ${bookingId} is stale ` +
            `(age ${Math.round(ageMs / 1000)}s). Expiring it before creating a new session.`,
        );
        const entity = new PaymentEntity(
          existingPendingPayment.id,
          existingPendingPayment.bookingId,
          Money.fromDecimal(
            existingPendingPayment.amount.toNumber(),
            existingPendingPayment.currency,
          ),
          existingPendingPayment.method,
          existingPendingPayment.transactionId,
          existingPendingPayment.status,
          existingPendingPayment.createdAt,
        );
        entity.expire();
        await this.prisma.payment.update({
          where: { id: existingPendingPayment.id },
          data: { status: entity.status },
        });

        if (existingPendingPayment.transactionId) {
          await this.paymentGateway.expireSession(
            existingPendingPayment.transactionId,
          );
        }
      }
    }
    // ─── End idempotency gate ─────────────────────────────────────────────────

    const chargeCurrency = booking.invoice?.currency || 'USD';
    const money = Money.fromDecimal(
      booking.totalAmountUsd.toNumber(),
      chargeCurrency,
    );

    let session;
    try {
      session = await this.paymentGateway.createSession(
        booking.id,
        money.toDecimal(),
        money.currency,
        booking.referenceCode,
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Unknown gateway error';
      this.logger.error(
        `Failed to create payment session for bookingId=${bookingId} ref=${booking.referenceCode}: ${msg}`,
      );
      throw error;
    }

    try {
      const mockEntity = new PaymentEntity(
        'mock-id',
        bookingId,
        money,
        this.paymentGateway.getProviderName(),
        session.transactionId,
        'PENDING',
        new Date(),
      );

      await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: money.toDecimal(),
          currency: money.currency,
          method: this.paymentGateway.getProviderName(),
          transactionId: session.transactionId,
          sessionUrl: session.url,
          status: mockEntity.status,
        },
      });

      this.eventEmitter.emit(PAYMENT_EVENTS.INITIATED, {
        paymentId: session.transactionId,
        bookingId: booking.id,
        amountUsd: money.toDecimal(),
        gateway: this.paymentGateway.getProviderName(),
      });

      this.logger.log(
        `Payment initiated for booking ${booking.id} with transactionId ${session.transactionId}`,
      );
      return session;
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      // P2002 from partial unique index: clean up losing orphan session
      if (errObj.code === 'P2002') {
        this.logger.warn(
          `Concurrent duplicate initiatePayment for booking ${bookingId} caught at DB level (P2002). ` +
            `Expiring orphan session ${session.transactionId} and fetching winning session.`,
        );
        try {
          await this.paymentGateway.expireSession(session.transactionId);
        } catch (expireErr: unknown) {
          const expMsg =
            expireErr instanceof Error
              ? expireErr.message
              : 'Unknown expire error';
          this.logger.error(
            `Failed to expire orphan session ${session.transactionId}: ${expMsg}`,
          );
        }

        const concurrent = await this.prisma.payment.findFirst({
          where: { bookingId, status: 'PENDING', isRefund: false },
        });
        if (concurrent?.sessionUrl && concurrent?.transactionId) {
          return {
            url: concurrent.sessionUrl,
            transactionId: concurrent.transactionId,
          };
        }
      }

      this.logger.error(
        `Database failure during initiatePayment for bookingId=${bookingId} ref=${booking.referenceCode}, ` +
          `expiring session ${session.transactionId}. Error: ${errObj.message}`,
      );

      // Compensating action: expire the unpaid session we just created
      try {
        await this.paymentGateway.expireSession(session.transactionId);
        this.logger.log(
          `Successfully expired unpaid session ${session.transactionId} after DB failure`,
        );
      } catch (expireError: unknown) {
        const expMsg =
          expireError instanceof Error
            ? expireError.message
            : 'Unknown expire error';
        this.logger.error(
          `CRITICAL: Failed to expire session ${session.transactionId} after DB failure: ${expMsg}`,
        );
      }

      throw error;
    }
  }

  async handleWebhook(req: ExpressRequest, rawBody: Buffer) {
    const payload = await this.paymentGateway.verifyAndParseWebhook(
      req,
      rawBody,
    );
    const provider = this.paymentGateway.getProviderName();

    if (!payload.eventId) {
      this.logger.error(
        `Webhook payload missing eventId, cannot guarantee idempotency. Rejecting silently (200) to prevent Stripe retry storms.`,
      );
      return { received: true };
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let lastError: unknown = null;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const existingEvent = await tx.processedWebhookEvent.findUnique({
              where: { id: payload.eventId },
            });

            if (existingEvent) {
              this.logger.log(
                `Webhook event ${payload.eventId} already processed. Returning 200.`,
              );
              return;
            }

            if (payload.status === 'COMPLETED') {
              await this.handleSuccessfulPaymentTx(
                tx,
                payload.bookingId,
                payload.amountUsd,
                payload.paymentId,
                payload.currency || 'USD',
              );
            } else {
              this.logger.log(
                `Unhandled or pending payment status: ${payload.status} for booking ${payload.bookingId}`,
              );
            }

            await tx.processedWebhookEvent.create({
              data: {
                id: payload.eventId,
                provider,
                payload: payload.rawEvent as unknown as Prisma.InputJsonValue,
              },
            });
          },
          { isolationLevel: 'Serializable' },
        );
        success = true;
      } catch (error: unknown) {
        const errObj = error as { code?: string };
        if (errObj.code === 'P2002') {
          // Unique constraint collision on processedWebhookEvent means duplicate concurrent delivery already succeeded
          this.logger.log(
            `Webhook event ${payload.eventId} concurrently processed (P2002). Returning 200.`,
          );
          return { received: true };
        }
        if (errObj.code === 'P2034' && attempt < maxRetries) {
          this.logger.warn(
            `P2034 serialization failure on webhook ${payload.eventId}, retrying attempt ${attempt}/${maxRetries}...`,
          );
          await new Promise((res) => setTimeout(res, 50 * attempt));
          continue;
        }
        lastError = error;
        break;
      }
    }

    if (!success) {
      this.logger.error(
        `Webhook transaction failed for event ${payload.eventId} after ${attempt} attempts. Throwing to trigger gateway retry.`,
      );
      throw lastError instanceof Error
        ? lastError
        : new Error('Webhook transaction processing failed');
    }

    // Post-commit side-effects
    this.eventEmitter.emit(PAYMENT_EVENTS.SUCCEEDED, {
      paymentId: payload.paymentId,
      bookingId: payload.bookingId,
      amountUsd: payload.amountUsd,
      transactionId: payload.paymentId,
      gateway: provider,
    });

    this.prisma.analyticsEvent
      .create({
        data: {
          eventId: `payment:${payload.paymentId}:succeeded`,
          eventName: 'payment_succeeded',
          bookingRef: payload.bookingId,
          properties: {
            paymentId: payload.paymentId,
            amountUsd: payload.amountUsd,
            currency: payload.currency || 'USD',
            gateway: provider,
          },
        },
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Unknown analytics error';
        this.logger.warn(`Failed to log server analytics event: ${msg}`);
      });

    return { received: true };
  }

  private async handleSuccessfulPaymentTx(
    tx: Prisma.TransactionClient,
    bookingId: string,
    amountUsd: number,
    transactionId: string,
    currency: string,
  ) {
    if (!bookingId) {
      this.logger.warn('Received successful payment without bookingId');
      return;
    }

    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });
    if (!booking) {
      throw new NotFoundException(
        `Booking ${bookingId} not found during payment fulfillment`,
      );
    }

    const existingPayment = await tx.payment.findFirst({
      where: {
        OR: [{ transactionId }, { bookingId, status: 'PENDING' }],
      },
    });

    if (existingPayment) {
      if (
        existingPayment.amount.toNumber() !== amountUsd ||
        existingPayment.currency !== currency
      ) {
        throw new UnprocessableEntityException(
          `Webhook amount (${amountUsd} ${currency}) does not match expected payment record (${existingPayment.amount.toNumber()} ${existingPayment.currency})`,
        );
      }
    }

    let payment;
    if (existingPayment) {
      const paymentEntity = new PaymentEntity(
        existingPayment.id,
        existingPayment.bookingId,
        Money.fromDecimal(
          existingPayment.amount.toNumber(),
          existingPayment.currency,
        ),
        existingPayment.method,
        existingPayment.transactionId,
        existingPayment.status,
        existingPayment.createdAt,
      );
      paymentEntity.markCaptured();

      payment = await tx.payment.update({
        where: { id: existingPayment.id },
        data: { status: paymentEntity.status },
      });
    } else {
      const money = Money.fromDecimal(amountUsd, currency);
      const mockEntity = new PaymentEntity(
        'mock-id',
        bookingId,
        money,
        this.paymentGateway.getProviderName(),
        transactionId,
        'PENDING',
        new Date(),
      );
      mockEntity.markCaptured();

      payment = await tx.payment.create({
        data: {
          bookingId: bookingId,
          amount: money.toDecimal(),
          currency: money.currency,
          method: this.paymentGateway.getProviderName(),
          transactionId: transactionId,
          status: mockEntity.status,
        },
      });
    }

    const allCapturedPayments = await tx.payment.findMany({
      where: { bookingId, status: 'CAPTURED' },
    });

    const totalCaptured = allCapturedPayments.reduce(
      (sum: number, p: { amount: Prisma.Decimal }) => sum + Number(p.amount),
      0,
    );
    const newStatus =
      totalCaptured >= Number(booking.totalAmountUsd)
        ? 'PAID'
        : 'PARTIALLY_PAID';

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        paidAmountUsd: totalCaptured,
      },
    });

    if (booking.invoice) {
      await tx.invoice.update({
        where: { id: booking.invoice.id },
        data: {
          status: newStatus === 'PAID' ? 'PAID' : 'SENT',
          paymentId: payment.id,
        },
      });
    }

    await tx.bookingActivityLog.create({
      data: {
        bookingId,
        action: 'PAYMENT_CAPTURED',
        details: {
          paymentId: payment.id,
          amountCaptured: amountUsd,
          currency,
          newBookingStatus: newStatus,
        },
      },
    });

    this.logger.log(
      `Payment successful and captured for booking ${bookingId}. Total captured: ${totalCaptured}. Status updated to ${newStatus}.`,
    );
  }

  async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string,
    idempotencyKey?: string,
    actor?: { id: string; role: string },
  ) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true, invoices: true },
    });

    if (!existingPayment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (existingPayment.status !== 'CAPTURED') {
      throw new BadRequestException(
        `Payment ${paymentId} is in status ${existingPayment.status} and cannot be refunded. Only CAPTURED payments can be refunded.`,
      );
    }

    const paymentAmountDecimal = existingPayment.amount.toNumber();
    if (amount !== undefined && amount !== paymentAmountDecimal) {
      throw new BadRequestException(
        'Partial refunds are not currently supported. You must refund the full amount.',
      );
    }

    const ikey = idempotencyKey || `ref_${existingPayment.id}`;

    const existingRefundRecord = await this.prisma.refundRecord.findUnique({
      where: { idempotencyKey: ikey },
    });

    if (existingRefundRecord && existingRefundRecord.status === 'COMPLETED') {
      this.logger.log(
        `Duplicate refund request caught by idempotency key ${ikey}. Returning cached result.`,
      );
      return {
        success: true,
        refundId: existingRefundRecord.providerRefundId,
        status: 'REFUNDED',
      };
    }

    const refundMoney = Money.fromDecimal(
      paymentAmountDecimal,
      existingPayment.currency,
    );

    if (!existingPayment.transactionId) {
      throw new BadRequestException(
        'Cannot refund a payment without a transactionId',
      );
    }

    let refundRecord = existingRefundRecord;
    if (!refundRecord) {
      refundRecord = await this.prisma.refundRecord.create({
        data: {
          idempotencyKey: ikey,
          paymentId: existingPayment.id,
          amount: refundMoney.toDecimal(),
          currency: refundMoney.currency,
          status: 'PENDING',
          actorId: actor?.id || null,
          actorRole: actor?.role || null,
          reason: reason || null,
        },
      });
    }

    let refundResult: { refundId: string };
    try {
      refundResult = await this.paymentGateway.refund(
        existingPayment.transactionId,
        amount,
        ikey,
      );
    } catch (refundErr: unknown) {
      const msg =
        refundErr instanceof Error
          ? refundErr.message
          : 'Unknown gateway error';
      await this.prisma.refundRecord.update({
        where: { id: refundRecord.id },
        data: { status: 'FAILED', failureReason: msg },
      });
      throw refundErr;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: 'REFUNDED',
          isRefund: true,
        },
      });

      await tx.booking.update({
        where: { id: existingPayment.bookingId },
        data: {
          status: 'REFUNDED',
          paidAmountUsd: 0,
          cancellationReason: reason || 'Payment refunded by admin',
        },
      });

      const invoice = existingPayment.invoices[0];
      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'CREDIT_NOTE' },
        });
      }

      await tx.refundRecord.update({
        where: { id: refundRecord.id },
        data: {
          status: 'COMPLETED',
          providerRefundId: refundResult.refundId,
        },
      });

      // Reverse promotion redemption if exists
      const redemption = await tx.promotionRedemption.findUnique({
        where: { bookingId: existingPayment.bookingId },
      });
      if (redemption && redemption.status === 'ACTIVE') {
        await tx.promotionRedemption.update({
          where: { id: redemption.id },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
          },
        });
        await tx.promotion.update({
          where: { id: redemption.promotionId },
          data: { currentUses: { decrement: 1 } },
        });
      }

      // Restore availability capacity if slot present
      if (existingPayment.booking.availabilityId) {
        const totalPassengers =
          existingPayment.booking.adults + existingPayment.booking.children;
        await tx.tourAvailability.update({
          where: { id: existingPayment.booking.availabilityId },
          data: {
            remainingSeats: { increment: totalPassengers },
            status: 'AVAILABLE',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor?.id || null,
          actorRole: actor?.role || null,
          action: 'PAYMENT_REFUNDED',
          entityType: 'Payment',
          entityId: existingPayment.id,
          metadata: {
            refundId: refundResult.refundId,
            amount: refundMoney.toDecimal(),
            currency: refundMoney.currency,
            reason: reason || null,
          },
        },
      });
    });

    this.eventEmitter.emit(PAYMENT_EVENTS.REFUNDED, {
      paymentId: existingPayment.id,
      bookingId: existingPayment.bookingId,
      amount: refundMoney.toDecimal(),
      currency: refundMoney.currency,
      refundId: refundResult.refundId,
    });

    this.prisma.analyticsEvent
      .create({
        data: {
          eventId: `refund:${existingPayment.id}:completed`,
          eventName: 'refund_completed',
          properties: {
            paymentId: existingPayment.id,
            bookingId: existingPayment.bookingId,
            refundAmount: refundMoney.toDecimal(),
            refundId: refundResult.refundId,
          },
        },
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Unknown analytics error';
        this.logger.warn(
          `Failed to log server analytics event refund_completed: ${msg}`,
        );
      });

    this.logger.log(
      `Refund ${refundResult.refundId} issued for payment ${existingPayment.id} (booking ${existingPayment.bookingId})`,
    );

    return {
      success: true,
      refundId: refundResult.refundId,
      status: 'REFUNDED',
    };
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment || payment.booking.userId !== userId) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    return {
      status: payment.status,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      updatedAt: payment.updatedAt,
    };
  }
}
