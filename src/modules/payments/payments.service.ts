import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
  ForbiddenException,
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
import { CommissionsService } from '../commissions/commissions.service';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

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
    private readonly commissionsService: CommissionsService,
  ) {}

  async initiatePayment(
    bookingId: string,
    userId?: string,
    guestToken?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tour: true,
        invoice: true,
        payments: {
          where: { status: 'CAPTURED', isRefund: false },
          select: { amount: true },
        },
      },
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
        tokenHash.length === booking.guestTokenHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(tokenHash, 'hex'),
          Buffer.from(booking.guestTokenHash, 'hex'),
        )
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // Mask foreign/unauthorized booking as 404 Not Found to prevent leaking existence
      throw new NotFoundException('Booking not found');
    }

    if (!['PENDING', 'PARTIALLY_PAID'].includes(booking.status)) {
      throw new BadRequestException(
        `Booking is in ${booking.status} status and cannot be paid.`,
      );
    }

    if (
      !booking.invoice ||
      booking.tour.currency !== 'USD' ||
      booking.invoice.currency !== 'USD' ||
      !booking.invoice.total.equals(booking.totalAmountUsd) ||
      booking.totalAmountUsd.lte(0)
    ) {
      this.logger.error(
        `Payment blocked because the immutable financial snapshot is invalid for bookingId=${booking.id}`,
      );
      throw new UnprocessableEntityException(
        'Booking financial snapshot is not payable',
      );
    }

    const totalCaptured = booking.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const amountDue = booking.totalAmountUsd.minus(totalCaptured);
    if (amountDue.lte(0)) {
      throw new ConflictException('Booking has no outstanding balance');
    }

    // ─── Idempotency gate ────────────────────────────────────────────────────
    const existingPendingPayment = await this.prisma.payment.findFirst({
      where: { bookingId, status: 'PENDING', isRefund: false },
    });

    if (existingPendingPayment) {
      const ageMs = Date.now() - existingPendingPayment.createdAt.getTime();
      const isReusable =
        ageMs < PaymentsService.SESSION_TTL_MS &&
        Boolean(existingPendingPayment.sessionUrl) &&
        existingPendingPayment.currency === 'USD' &&
        existingPendingPayment.amount.equals(amountDue);

      if (isReusable) {
        this.logger.log(
          `Duplicate initiatePayment for booking ${bookingId}: returning existing session ` +
            `${existingPendingPayment.transactionId} (age ${Math.round(ageMs / 1000)}s)`,
        );
        return {
          url: existingPendingPayment.sessionUrl!,
          transactionId: existingPendingPayment.transactionId,
        };
      } else {
        this.logger.log(
          `PENDING Payment ${existingPendingPayment.id} is no longer reusable. Expiring it before creating a new session.`,
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

    const chargeCurrency = 'USD';
    const money = Money.fromDecimal(amountDue.toNumber(), chargeCurrency);

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
        'Webhook payload missing eventId; refusing non-idempotent processing',
      );
      throw new BadRequestException('Invalid payment event');
    }
    if (
      payload.status === 'COMPLETED' &&
      (!Number.isFinite(payload.amountUsd) ||
        payload.amountUsd <= 0 ||
        payload.currency !== 'USD')
    ) {
      throw new UnprocessableEntityException(
        'Invalid successful payment amount or currency',
      );
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let shouldEmitSuccess = false;
    let lastError: unknown = null;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        const outcome = await this.prisma.$transaction(
          async (tx) => {
            const existingEvent = await tx.processedWebhookEvent.findUnique({
              where: { id: payload.eventId },
            });

            if (existingEvent) {
              this.logger.log(
                `Webhook event ${payload.eventId} already processed. Returning 200.`,
              );
              return 'DUPLICATE' as const;
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
                payload: {
                  paymentId: payload.paymentId,
                  bookingId: payload.bookingId,
                  status: payload.status,
                  amount: payload.amountUsd,
                  currency: payload.currency || 'USD',
                },
              },
            });
            return payload.status === 'COMPLETED'
              ? ('PAYMENT_SUCCEEDED' as const)
              : ('NON_SUCCESS_EVENT' as const);
          },
          { isolationLevel: 'Serializable' },
        );
        shouldEmitSuccess = outcome === 'PAYMENT_SUCCEEDED';
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

    if (!shouldEmitSuccess) {
      return { received: true };
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
      throw new UnprocessableEntityException(
        'Successful payment is missing a booking reference',
      );
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
        transactionId,
        bookingId,
        status: 'PENDING',
        isRefund: false,
      },
    });

    if (!existingPayment) {
      throw new UnprocessableEntityException(
        'No matching pending payment session exists',
      );
    }

    const webhookAmount = new Prisma.Decimal(amountUsd.toFixed(2));
    if (
      !existingPayment.amount.equals(webhookAmount) ||
      existingPayment.currency !== currency
    ) {
      throw new UnprocessableEntityException(
        'Webhook amount or currency does not match the expected payment',
      );
    }

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

    const payment = await tx.payment.update({
      where: { id: existingPayment.id },
      data: { status: paymentEntity.status },
    });

    const allCapturedPayments = await tx.payment.findMany({
      where: { bookingId, status: 'CAPTURED' },
    });

    const totalCaptured = allCapturedPayments.reduce(
      (sum: Prisma.Decimal, p: { amount: Prisma.Decimal }) =>
        sum.plus(p.amount),
      new Prisma.Decimal(0),
    );
    if (totalCaptured.gt(booking.totalAmountUsd)) {
      throw new UnprocessableEntityException(
        'Captured payments exceed the booking total',
      );
    }
    const newStatus =
      totalCaptured.equals(booking.totalAmountUsd)
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
          amountCaptured: webhookAmount.toFixed(2),
          currency,
          newBookingStatus: newStatus,
        },
      },
    });

    this.logger.log(
      `Payment successful and captured for booking ${bookingId}. Total captured: ${totalCaptured.toFixed(2)}. Status updated to ${newStatus}.`,
    );
  }

  async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string,
    idempotencyKey?: string,
    actor?: { id: string; role: string },
  ) {
    if (!actor || actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a super admin can issue refunds');
    }
    if (!idempotencyKey) {
      throw new BadRequestException('Refund idempotency key is required');
    }
    const safeReason = reason
      ? sanitizePlainText(reason).slice(0, 500)
      : undefined;
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true, invoices: true },
    });

    if (!existingPayment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const paymentAmountDecimal = existingPayment.amount.toNumber();
    const requestedAmount =
      amount === undefined
        ? existingPayment.amount
        : new Prisma.Decimal(amount);
    if (!requestedAmount.equals(existingPayment.amount)) {
      throw new BadRequestException(
        'Partial refunds are not currently supported. You must refund the full amount.',
      );
    }

    const ikey = idempotencyKey;
    if (
      ikey.length > 100 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(ikey)
    ) {
      throw new BadRequestException('Invalid refund idempotency key');
    }

    let refundRecord = await this.prisma.refundRecord.findUnique({
      where: { idempotencyKey: ikey },
    });

    if (
      refundRecord &&
      (refundRecord.paymentId !== existingPayment.id ||
        !refundRecord.amount.equals(existingPayment.amount) ||
        refundRecord.currency !== existingPayment.currency)
    ) {
      throw new ConflictException(
        'The idempotency key is already assigned to another refund',
      );
    }

    if (refundRecord?.status === 'COMPLETED') {
      this.logger.log(
        `Duplicate refund request caught by idempotency key ${ikey}. Returning cached result.`,
      );
      await this.ensureCommissionReversed(existingPayment.bookingId);
      return {
        success: true,
        refundId: refundRecord.providerRefundId,
        status: 'REFUNDED',
      };
    }

    const capturedPayments = await this.prisma.payment.findMany({
      where: {
        bookingId: existingPayment.bookingId,
        status: 'CAPTURED',
        isRefund: false,
      },
      select: { id: true, amount: true },
    });
    const isRefundRecovery =
      existingPayment.status === 'REFUND_PENDING' &&
      Boolean(
        refundRecord &&
          (refundRecord.status === 'PENDING' ||
            refundRecord.status === 'FAILED'),
      );
    if (
      existingPayment.booking.status !== 'PAID' ||
      !existingPayment.amount.equals(existingPayment.booking.totalAmountUsd) ||
      !existingPayment.amount.equals(existingPayment.booking.paidAmountUsd) ||
      (isRefundRecovery
        ? capturedPayments.length !== 0
        : capturedPayments.length !== 1 ||
          capturedPayments[0].id !== existingPayment.id)
    ) {
      throw new BadRequestException(
        'Only a fully paid booking with one captured payment can be refunded',
      );
    }

    if (
      existingPayment.status !== 'CAPTURED' &&
      !(
        existingPayment.status === 'REFUND_PENDING' &&
        refundRecord &&
        (refundRecord.status === 'PENDING' ||
          refundRecord.status === 'FAILED')
      )
    ) {
      throw new BadRequestException(
        'Payment is not eligible for a refund',
      );
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

    if (existingPayment.status === 'CAPTURED') {
      try {
        refundRecord = await this.prisma.$transaction(
          async (tx) => {
            const claimed = await tx.payment.updateMany({
              where: {
                id: existingPayment.id,
                status: 'CAPTURED',
                isRefund: false,
              },
              data: { status: 'REFUND_PENDING' },
            });
            if (claimed.count !== 1) {
              throw new ConflictException(
                'A refund is already in progress for this payment',
              );
            }

            if (refundRecord) {
              return tx.refundRecord.update({
                where: { id: refundRecord.id },
                data: {
                  status: 'PENDING',
                  failureReason: null,
                  actorId: actor?.id || null,
                  actorRole: actor?.role || null,
                  reason: safeReason || null,
                },
              });
            }

            return tx.refundRecord.create({
              data: {
                idempotencyKey: ikey,
                paymentId: existingPayment.id,
                amount: refundMoney.toDecimal(),
                currency: refundMoney.currency,
                status: 'PENDING',
                actorId: actor?.id || null,
                actorRole: actor?.role || null,
                reason: safeReason || null,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        const code = (error as { code?: string }).code;
        if (code === 'P2002' || code === 'P2034') {
          throw new ConflictException(
            'A refund is already in progress for this payment',
          );
        }
        throw error;
      }
    } else {
      if (!refundRecord) {
        throw new ConflictException(
          'Refund recovery record is missing',
        );
      }

      const leaseAgeMs = Date.now() - refundRecord.updatedAt.getTime();
      if (refundRecord.status === 'PENDING' && leaseAgeMs < 60_000) {
        throw new ConflictException(
          'A refund is already in progress for this payment',
        );
      }

      const claimed = await this.prisma.refundRecord.updateMany({
        where: {
          id: refundRecord.id,
          status: refundRecord.status,
          updatedAt: refundRecord.updatedAt,
        },
        data: {
          status: 'PENDING',
          failureReason: null,
          actorId: actor?.id || null,
          actorRole: actor?.role || null,
          reason: safeReason || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'A refund is already in progress for this payment',
        );
      }
      refundRecord = await this.prisma.refundRecord.findUniqueOrThrow({
        where: { id: refundRecord.id },
      });
    }

    let refundResult: { refundId: string };
    try {
      refundResult = await this.paymentGateway.refund(
        existingPayment.transactionId,
        paymentAmountDecimal,
        ikey,
      );
    } catch (refundErr: unknown) {
      const msg =
        refundErr instanceof Error
          ? refundErr.message
          : 'Unknown gateway error';
      this.logger.error(
        `Refund provider request failed for paymentId=${existingPayment.id}: ${msg}`,
      );
      await this.prisma.refundRecord.updateMany({
        where: { id: refundRecord.id },
        data: {
          status: 'FAILED',
          failureReason: 'Payment provider refund request failed',
        },
      });
      throw refundErr;
    }

    await this.prisma.$transaction(
      async (tx) => {
        const finalized = await tx.payment.updateMany({
          where: {
            id: existingPayment.id,
            status: 'REFUND_PENDING',
          },
          data: {
            status: 'REFUNDED',
            isRefund: true,
          },
        });
        if (finalized.count !== 1) {
          throw new ConflictException(
            'Refund state changed during finalization',
          );
        }

        await tx.booking.update({
          where: { id: existingPayment.bookingId },
          data: {
            status: 'REFUNDED',
            paidAmountUsd: 0,
            cancellationReason:
              safeReason || 'Payment refunded by super admin',
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
            failureReason: null,
          },
        });

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
          await tx.promotion.updateMany({
            where: {
              id: redemption.promotionId,
              currentUses: { gt: 0 },
            },
            data: { currentUses: { decrement: 1 } },
          });
        }

        if (existingPayment.booking.availabilityId) {
          const totalPassengers =
            existingPayment.booking.adults +
            existingPayment.booking.children;
          await tx.$executeRaw`
            UPDATE tour_availabilities
            SET remaining_seats = LEAST(
                  total_capacity,
                  remaining_seats + ${totalPassengers}
                ),
                status = 'AVAILABLE',
                updated_at = NOW()
            WHERE id = ${existingPayment.booking.availabilityId}
          `;
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
              reason: safeReason || null,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.ensureCommissionReversed(existingPayment.bookingId);

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

  private async ensureCommissionReversed(bookingId: string) {
    try {
      await this.commissionsService.reverseCommissionForBooking(bookingId);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown reversal error';
      this.logger.error(
        `CRITICAL: commission reversal failed for refunded bookingId=${bookingId}: ${message}`,
      );
      await this.prisma.auditLog.create({
        data: {
          action: 'COMMISSION_REVERSAL_REQUIRES_RECONCILIATION',
          entityType: 'Booking',
          entityId: bookingId,
          metadata: { error: 'Commission reversal failed' },
        },
      });
    }
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
