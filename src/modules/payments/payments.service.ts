import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  Inject,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, BookingStatus } from '@prisma/client';
import { Request as ExpressRequest } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_EVENTS } from '../../common/events/payment-events';
import { Money } from '../../common/domain/value-objects/money.vo';
import { PaymentEntity } from './domain/payment.entity';
import crypto from 'crypto';
import { CommissionsService } from '../commissions/commissions.service';
import { AvailabilityService } from '../availability/availability.service';
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
    private readonly availabilityService: AvailabilityService,
  ) {}

  getReadiness() {
    return this.paymentGateway.getReadiness();
  }

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
        billingInfo: true,
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

    if (booking.invoice?.status === 'VOID') {
      throw new BadRequestException(
        'Cannot initiate payment for a voided invoice. Please contact support.',
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
          paymentId: existingPendingPayment.id,
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
    if (!booking.billingInfo) {
      throw new UnprocessableEntityException(
        'Booking billing information is required for online payment',
      );
    }

    const paymentId = crypto.randomUUID();
    const attemptNumber =
      (await this.prisma.payment.count({ where: { bookingId } })) + 1;
    // Always use the fresh paymentId as the idempotency key.
    const checkoutIdempotencyKey = `checkout:${paymentId}`;

    let session;
    try {
      session = await this.paymentGateway.createSession({
        paymentId,
        bookingId: booking.id,
        referenceCode: booking.referenceCode,
        amount: money.toDecimal().toFixed(2),
        currency: money.currency,
        customer: {
          fullName: booking.billingInfo.fullName,
          email: booking.billingInfo.email,
          phone: booking.billingInfo.phone,
        },
        idempotencyKey: checkoutIdempotencyKey,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Unknown gateway error';
      this.logger.error(
        `Failed to create payment session for bookingId=${bookingId} ref=${booking.referenceCode}: ${msg}`,
      );
      throw error;
    }

    const providerTxId = session.providerInvoiceId;
    if (!providerTxId) {
      throw new ServiceUnavailableException('Payment gateway did not return a valid transaction ID');
    }

    try {
      const paymentEntity = new PaymentEntity(
        paymentId,
        bookingId,
        money,
        this.paymentGateway.getProviderName(),
        providerTxId,
        'PENDING',
        new Date(),
      );

      const payment = await this.prisma.payment.create({
        data: {
          id: paymentId,
          bookingId: booking.id,
          provider: this.paymentGateway.getProviderName(),
          providerEnvironment: this.paymentGateway.getReadiness().mode,
          merchantReference: booking.referenceCode,
          providerPaymentId: providerTxId,
          attemptNumber,
          idempotencyKey: checkoutIdempotencyKey,
          amount: money.toDecimal(),
          currency: money.currency,
          method: this.paymentGateway.getProviderName(),
          transactionId: providerTxId,
          sessionUrl: session.url,
          status: paymentEntity.status,
          providerStatus: 'PENDING',
          // PayLink's signed checkout expiry is authoritative for this attempt.
          expiresAt: session.expiresAt,
        },
      });

      const effectivePaymentId = payment?.id ?? paymentId;

      try {
        this.eventEmitter.emit(PAYMENT_EVENTS.INITIATED, {
          paymentId: effectivePaymentId,
          bookingId: booking.id,
          amountUsd: money.toDecimal(),
          gateway: this.paymentGateway.getProviderName(),
        });
      } catch {
        // Non-blocking event emission
      }

      this.logger.log(
        `Payment initiated for booking ${booking.id} with transactionId ${providerTxId}`,
      );

      if (this.paymentGateway.getProviderName() === 'MOCK') {
        await this.prisma.$transaction(async (tx) => {
          await this.handleSuccessfulPaymentTx(
            tx,
            booking.id,
            amountDue.toNumber(),
            providerTxId,
            chargeCurrency,
          );
        });
      }

      // The customer must poll using the opaque payment record ID, never a
      // provider session/transaction reference whose format is provider-owned.
      return { ...session, transactionId: providerTxId, paymentId: effectivePaymentId };
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      // P2002 from partial unique index: clean up losing orphan session
      if (errObj.code === 'P2002') {
        this.logger.warn(
          `Concurrent duplicate initiatePayment for booking ${bookingId} caught at DB level (P2002). ` +
            `Expiring orphan session ${providerTxId} and fetching winning session.`,
        );
        try {
          await this.paymentGateway.expireSession(providerTxId);
        } catch (expireErr: unknown) {
          const expMsg =
            expireErr instanceof Error
              ? expireErr.message
              : 'Unknown expire error';
          this.logger.error(
            `Failed to expire orphan session ${providerTxId}: ${expMsg}`,
          );
        }

        const concurrent = await this.prisma.payment.findFirst({
          where: { bookingId, status: 'PENDING', isRefund: false },
        });
        if (concurrent?.sessionUrl && concurrent?.transactionId) {
          return {
            url: concurrent.sessionUrl,
            transactionId: concurrent.transactionId,
            providerInvoiceId: concurrent.transactionId,
            paymentId: concurrent.id,
          };
        }
      }

      this.logger.error(
        `Database failure during initiatePayment for bookingId=${bookingId} ref=${booking.referenceCode}, ` +
          `expiring session ${providerTxId}. Error: ${errObj.message}`,
      );

      // Compensating action: expire the unpaid session we just created
      try {
        await this.paymentGateway.expireSession(providerTxId);
        this.logger.log(
          `Successfully expired unpaid session ${providerTxId} after DB failure`,
        );
      } catch (expireError: unknown) {
        const expMsg =
          expireError instanceof Error
            ? expireError.message
            : 'Unknown expire error';
        this.logger.error(
          `CRITICAL: Failed to expire session ${providerTxId} after DB write failure: ${expMsg}. ` +
            `Manual reconciliation required.`,
        );
      }

      throw new ServiceUnavailableException(
        'Failed to record payment attempt. Please try again.',
      );
    }
  }

  async handleWebhook(
    requestedProvider: string,
    req: ExpressRequest,
    rawBody: Buffer,
  ) {
    const activeProvider = this.paymentGateway.getProviderName();
    if (requestedProvider.trim().toUpperCase() !== activeProvider) {
      throw new NotFoundException('Payment webhook provider not found');
    }
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

    const existingEvent = await this.prisma.processedWebhookEvent.findUnique({
      where: { id: payload.eventId },
    });
    if (existingEvent) {
      this.logger.log(
        `Webhook event ${payload.eventId} already processed. Returning 200.`,
      );
      return { received: true };
    }

    let targetPaymentId = (payload as any).paymentId;
    let targetBookingId = (payload as any).bookingId;
    let targetAmount = (payload as any).amountUsd;
    let targetCurrency = (payload as any).currency || 'USD';

    if (!targetPaymentId || !targetBookingId) {
      const providerRef = payload.providerInvoiceId || (payload as any).paymentId;
      const matchedPayment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            ...(providerRef ? [{ transactionId: providerRef }, { providerPaymentId: providerRef }, { id: providerRef }] : []),
          ],
        },
      });

      if (!matchedPayment) {
        throw new UnprocessableEntityException(
          `Payment for provider reference ${providerRef} not found`,
        );
      }
      targetPaymentId = matchedPayment.id;
      targetBookingId = matchedPayment.bookingId;
      targetAmount = targetAmount ?? matchedPayment.amount.toNumber();
      targetCurrency = targetCurrency || matchedPayment.currency;
    }

    if (
      payload.status === 'COMPLETED' &&
      (!Number.isFinite(targetAmount) ||
        targetAmount <= 0 ||
        targetCurrency !== 'USD')
    ) {
      throw new UnprocessableEntityException(
        'Invalid successful payment amount or currency',
      );
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let shouldEmitSuccess = false;
    let shouldEmitFailure = false;
    let lastError: unknown = null;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        const outcome = await this.prisma.$transaction(
          async (tx) => {
            const duplicateCheck = await tx.processedWebhookEvent.findUnique({
              where: { id: payload.eventId },
            });

            if (duplicateCheck) {
              this.logger.log(
                `Webhook event ${payload.eventId} already processed. Returning 200.`,
              );
              return 'DUPLICATE' as const;
            }

            if (payload.status === 'COMPLETED') {
              await this.handleSuccessfulPaymentTx(
                tx,
                targetBookingId,
                targetAmount,
                targetPaymentId,
                targetCurrency,
              );
            } else if (payload.status === 'FAILED') {
              await this.handleFailedPaymentTx(
                tx,
                targetBookingId,
                targetPaymentId,
              );
            } else if (payload.status === 'PARTIALLY_REFUNDED') {
              // A webhook contains no refund amount.  Do not turn a partial
              // provider status into a full booking reversal; the separately
              // persisted refund record supplies that amount when applicable.
              await tx.payment.update({
                where: { id: targetPaymentId },
                data: { providerStatus: 'PARTIALLY_REFUNDED' },
              });
            } else if (['REFUNDED', 'VOIDED', 'REVERSED'].includes(payload.status)) {
              await this.handleProviderReversalTx(
                tx,
                targetPaymentId,
                targetBookingId,
                payload.status,
                payload.status === 'VOIDED' ? 'VOID' : 'CREDIT_NOTE',
              );
            } else {
              this.logger.log(
                `Unhandled or pending payment status: ${payload.status} for booking ${targetBookingId}`,
              );
            }

            await tx.processedWebhookEvent.create({
              data: {
                id: payload.eventId,
                provider,
                payload: {
                  paymentId: targetPaymentId,
                  bookingId: targetBookingId,
                  status: payload.status,
                  amount: targetAmount,
                  currency: targetCurrency,
                },
              },
            });
            if (payload.status === 'COMPLETED') {
              return 'PAYMENT_SUCCEEDED' as const;
            }
            if (payload.status === 'FAILED') {
              return 'PAYMENT_FAILED' as const;
            }
            if (['REFUNDED', 'VOIDED', 'REVERSED'].includes(payload.status)) {
              return 'PAYMENT_REVERSED' as const;
            }
            return 'NON_SUCCESS_EVENT' as const;
          },
          { isolationLevel: 'Serializable' },
        );
        shouldEmitSuccess = outcome === 'PAYMENT_SUCCEEDED';
        shouldEmitFailure = outcome === 'PAYMENT_FAILED';
        if (outcome === 'PAYMENT_REVERSED') {
          await this.ensureCommissionReversed(targetBookingId);
          this.eventEmitter.emit(PAYMENT_EVENTS.REFUNDED, {
            paymentId: targetPaymentId,
            bookingId: targetBookingId,
            amountUsd: targetAmount,
            reason: `Provider reversal: ${payload.status}`,
            gateway: provider,
          });
          return { received: true };
        }
        success = true;
      } catch (error: unknown) {
        const errObj = error as { code?: string };
        if (errObj.code === 'P2002') {
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

    if (shouldEmitFailure) {
      this.eventEmitter.emit(PAYMENT_EVENTS.FAILED, {
        paymentId: targetPaymentId,
        bookingId: targetBookingId,
        reason: 'Payment provider reported a failed payment',
        gateway: provider,
      });
      return { received: true };
    }

    if (!shouldEmitSuccess) {
      return { received: true };
    }

    this.eventEmitter.emit(PAYMENT_EVENTS.SUCCEEDED, {
      paymentId: targetPaymentId,
      bookingId: targetBookingId,
      amountUsd: targetAmount,
      transactionId: targetPaymentId,
      gateway: provider,
    });

    this.prisma.analyticsEvent
      .create({
        data: {
          eventId: `payment:${targetPaymentId}:succeeded`,
          eventName: 'payment_succeeded',
          bookingRef: targetBookingId,
          properties: {
            paymentId: targetPaymentId,
            amountUsd: targetAmount,
            currency: targetCurrency,
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

  private async handleFailedPaymentTx(
    tx: Prisma.TransactionClient,
    bookingId: string,
    transactionId: string,
  ): Promise<void> {
    if (!bookingId || !transactionId) {
      throw new UnprocessableEntityException(
        'Failed payment event is missing a booking or payment reference',
      );
    }

    const payment = await tx.payment.findFirst({
      where: {
        bookingId,
        OR: [
          { id: transactionId },
          { transactionId },
          { providerPaymentId: transactionId },
        ],
        status: { in: ['PENDING', 'AUTHORIZED'] },
        isRefund: false,
      },
    });
    if (!payment) {
      this.logger.warn(
        `No matching open payment session exists for failure webhook transactionId=${transactionId}`,
      );
      return;
    }

    const entity = new PaymentEntity(
      payment.id,
      payment.bookingId,
      Money.fromDecimal(payment.amount.toNumber(), payment.currency),
      payment.method,
      payment.transactionId,
      payment.status,
      payment.createdAt,
    );
    entity.markFailed();
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: entity.status,
        providerStatus: 'FAILED',
        failedAt: new Date(),
      },
    });
    await tx.bookingActivityLog.create({
      data: {
        bookingId,
        action: 'PAYMENT_FAILED',
        details: {
          paymentId: payment.id,
          transactionId,
          provider: this.paymentGateway.getProviderName(),
        },
      },
    });
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

    if (booking.status === 'REFUNDED' || booking.status === 'CANCELLED') {
      throw new UnprocessableEntityException(
        `Cannot capture payment for booking in terminal status ${booking.status}`,
      );
    }

    const existingPayment = await tx.payment.findFirst({
      where: {
        bookingId,
        OR: [
          { id: transactionId },
          { transactionId },
          { providerPaymentId: transactionId },
        ],
        status: { in: ['PENDING', 'EXPIRED'] },
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
      data: {
        status: paymentEntity.status,
        providerStatus: 'PAID',
        paidAt: new Date(),
      },
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
    // A verified payment confirms a booking; it never means the travel has
    // been completed. Payment status remains on the Payment record.
    const newStatus = totalCaptured.equals(booking.totalAmountUsd)
      ? 'CONFIRMED'
      : 'PARTIALLY_PAID';

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        paidAmountUsd: totalCaptured,
      },
    });

    if (
      booking.invoice &&
      booking.invoice.status !== 'VOID' &&
      booking.invoice.status !== 'PAID'
    ) {
      await tx.invoice.update({
        where: { id: booking.invoice.id },
        data: {
          status: newStatus === 'CONFIRMED' ? 'PAID' : 'SENT',
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

  private async handleProviderReversalTx(
    tx: Prisma.TransactionClient,
    paymentId: string,
    bookingId: string,
    providerStatus: string,
    invoiceStatus: 'VOID' | 'CREDIT_NOTE',
  ): Promise<void> {
    const payment = await tx.payment.findFirst({
      where: {
        bookingId,
        OR: [
          { id: paymentId },
          { transactionId: paymentId },
          { providerPaymentId: paymentId },
        ],
      },
    });
    if (
      !payment ||
      !['CAPTURED', 'REFUND_PENDING', 'PENDING', 'AUTHORIZED'].includes(
        payment.status,
      )
    ) {
      return;
    }

    let booking: any = null;
    try {
      booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { promotionRedemption: true },
      });
    } catch {
      // safe fallback if findUnique not mocked or fails
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED',
        isRefund: true,
        providerStatus,
        refundedAt: new Date(),
      },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'REFUNDED', paidAmountUsd: new Prisma.Decimal(0) },
    });

    if (booking?.availabilityId) {
      const seatsToRelease = booking.adults + (booking.children ?? 0);
      await this.availabilityService.releaseCapacity(
        tx,
        booking.availabilityId,
        seatsToRelease,
      );
    }

    if (
      booking?.promotionRedemption &&
      booking.promotionRedemption.status === 'ACTIVE'
    ) {
      const redemptionUpdate = await tx.promotionRedemption.updateMany({
        where: {
          id: booking.promotionRedemption.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'REVERSED',
          reversedAt: new Date(),
        },
      });

      if (redemptionUpdate.count > 0) {
        await tx.promotion.updateMany({
          where: {
            id: booking.promotionRedemption.promotionId,
            currentUses: { gt: 0 },
          },
          data: {
            currentUses: { decrement: 1 },
          },
        });
      }
    }

    await tx.invoice.updateMany({
      where: { bookingId },
      data: { status: invoiceStatus },
    });
    await tx.refundRecord.updateMany({
      where: { paymentId: payment.id, status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
    await tx.bookingActivityLog.create({
      data: {
        bookingId,
        action: 'PAYMENT_PROVIDER_REVERSED',
        details: { paymentId: payment.id, providerStatus },
      },
    });
  }

  async reconcilePaymentByProviderInvoiceId(
    providerInvoiceId: string,
    existingPayment?: { id: string; bookingId: string },
  ) {
    const provider = this.paymentGateway.getProviderName();
    const payment =
      existingPayment ||
      (await this.prisma.payment.findFirst({
        where: {
          provider,
          providerPaymentId: providerInvoiceId,
          isRefund: false,
        },
        select: { id: true, bookingId: true },
      })) ||
      (await this.prisma.payment.findFirst({
        where: {
          transactionId: providerInvoiceId,
          isRefund: false,
        },
        select: { id: true, bookingId: true },
      }));

    if (!payment) {
      throw new NotFoundException(
        `Payment record with provider reference ${providerInvoiceId} not found`,
      );
    }

    const checked = await this.paymentGateway.checkStatus(providerInvoiceId);
    const providerStatus = checked.providerStatus;

    const eventId = `paylink:reconcile:${crypto
      .createHash('sha256')
      .update(`${provider}|${providerInvoiceId}|${providerStatus}`)
      .digest('hex')}`;
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const alreadyApplied = await tx.processedWebhookEvent.findUnique({
          where: { id: eventId },
        });
        if (alreadyApplied) return 'DUPLICATE' as const;

        const currentPayment = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        let transition: 'SUCCEEDED' | 'REVERSED' | 'NONE' = 'NONE';
        if (providerStatus === 'PAID' && currentPayment.status === 'PENDING') {
          await this.handleSuccessfulPaymentTx(
            tx,
            currentPayment.bookingId,
            currentPayment.amount.toNumber(),
            providerInvoiceId,
            currentPayment.currency,
          );
          transition = 'SUCCEEDED';
        } else if (
          ['REFUNDED', 'VOIDED', 'REVERSED'].includes(providerStatus) &&
          ['CAPTURED', 'REFUND_PENDING', 'PENDING', 'AUTHORIZED'].includes(
            currentPayment.status,
          )
        ) {
          await this.handleProviderReversalTx(
            tx,
            currentPayment.id,
            currentPayment.bookingId,
            providerStatus,
            providerStatus === 'VOIDED' ? 'VOID' : 'CREDIT_NOTE',
          );
          transition = 'REVERSED';
        }

        await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            providerStatus,
            lastProviderCheckAt: new Date(),
          },
        });
        await tx.processedWebhookEvent.create({
          data: {
            id: eventId,
            provider,
            payload: {
              source: 'status_reconciliation',
              paymentId: currentPayment.id,
              providerInvoiceId,
              providerStatus,
            },
          },
        });
        return {
          transition,
          paymentId: currentPayment.id,
          bookingId: currentPayment.bookingId,
          amount: currentPayment.amount.toNumber(),
          currency: currentPayment.currency,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (outcome !== 'DUPLICATE' && outcome.transition === 'SUCCEEDED') {
      this.eventEmitter.emit(PAYMENT_EVENTS.SUCCEEDED, {
        paymentId: outcome.paymentId,
        bookingId: outcome.bookingId,
        amountUsd: outcome.amount,
        transactionId: providerInvoiceId,
        gateway: provider,
      });
    } else if (outcome !== 'DUPLICATE' && outcome.transition === 'REVERSED') {
      await this.ensureCommissionReversed(outcome.bookingId);
      this.eventEmitter.emit(PAYMENT_EVENTS.REFUNDED, {
        paymentId: outcome.paymentId,
        bookingId: outcome.bookingId,
        amountUsd: outcome.amount,
        reason: `Reconciliation reversal: ${providerStatus}`,
        gateway: provider,
      });
    }

    return outcome;
  }

  async reconcilePayLinkCallback(
    callbackPayload: {
      success: number | string | boolean;
      invoice_id: number | string;
      invoice_status?: string;
      message?: string;
      signature?: string;
    },
    userId?: string,
    guestToken?: string,
  ) {
    // A browser redirect is not financial truth. Verify its provider signature
    // and make sure the authenticated caller owns the matching Dunas booking
    // before any status reconciliation can happen.
    const providerInvoiceId = this.paymentGateway.verifyCallback({
      success: callbackPayload.success,
      invoice_id: callbackPayload.invoice_id,
      invoice_status: callbackPayload.invoice_status || '',
      message: callbackPayload.message || '',
      signature: callbackPayload.signature || '',
    });
    const callbackPayment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionId: providerInvoiceId },
          { providerPaymentId: providerInvoiceId },
        ],
      },
      include: {
        booking: {
          select: {
            id: true,
            referenceCode: true,
            status: true,
            totalAmountUsd: true,
            paidAmountUsd: true,
            userId: true,
            guestTokenHash: true,
            invoice: { select: { invoiceNumber: true } },
          },
        },
      },
    });
    if (!callbackPayment) {
      throw new NotFoundException('Payment not found');
    }

    let isAuthorized = false;
    if (userId && callbackPayment.booking.userId === userId) {
      isAuthorized = true;
    } else if (guestToken && callbackPayment.booking.guestTokenHash) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      if (
        tokenHash.length === callbackPayment.booking.guestTokenHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(tokenHash, 'hex'),
          Buffer.from(callbackPayment.booking.guestTokenHash, 'hex'),
        )
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new NotFoundException('Payment not found');
    }
    const outcome = await this.reconcilePaymentByProviderInvoiceId(
      providerInvoiceId,
    );
    if (outcome === 'DUPLICATE') {
      const p = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { transactionId: String(callbackPayload.invoice_id) },
            { providerPaymentId: String(callbackPayload.invoice_id) },
          ],
        },
      });
      return {
        paymentId: p?.id,
        status: p?.status,
        invoiceNumber: callbackPayment.booking.invoice?.invoiceNumber ?? null,
        booking: {
          id: callbackPayment.booking.id,
          referenceCode: callbackPayment.booking.referenceCode,
          status: callbackPayment.booking.status,
          totalAmountUsd: callbackPayment.booking.totalAmountUsd,
          paidAmountUsd: callbackPayment.booking.paidAmountUsd,
        },
      };
    }
    return {
      paymentId: outcome.paymentId,
      status:
        outcome.transition === 'SUCCEEDED'
          ? 'CAPTURED'
          : outcome.transition === 'REVERSED'
            ? 'REFUNDED'
            : 'PENDING',
      invoiceNumber: callbackPayment.booking.invoice?.invoiceNumber ?? null,
      booking: {
        id: callbackPayment.booking.id,
        referenceCode: callbackPayment.booking.referenceCode,
        status:
          outcome.transition === 'SUCCEEDED'
            ? 'CONFIRMED'
            : callbackPayment.booking.status,
        totalAmountUsd: callbackPayment.booking.totalAmountUsd,
        paidAmountUsd: callbackPayment.booking.paidAmountUsd,
      },
    };
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
    const priorRefunds = await this.prisma.refundRecord.aggregate({
      where: { paymentId, status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const previouslyRefunded = new Prisma.Decimal(
      priorRefunds._sum.amount ?? 0,
    );
    const refundableAmount = existingPayment.amount.minus(previouslyRefunded);
    const refundAmountDecimal =
      amount === undefined ? refundableAmount.toNumber() : Number(amount);
    if (
      !Number.isFinite(refundAmountDecimal) ||
      refundAmountDecimal <= 0 ||
      refundAmountDecimal > refundableAmount.toNumber()
    ) {
      throw new BadRequestException(
        `Refund amount must be between 0.01 and ${refundableAmount.toFixed(2)} ${existingPayment.currency}`,
      );
    }

    const isPartial = refundAmountDecimal < refundableAmount.toNumber();
    const ikey = idempotencyKey;
    if (ikey.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(ikey)) {
      throw new BadRequestException('Invalid refund idempotency key');
    }

    let refundRecord = await this.prisma.refundRecord.findUnique({
      where: { idempotencyKey: ikey },
    });

    if (
      refundRecord &&
      (refundRecord.paymentId !== existingPayment.id ||
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
        status: isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
      };
    }

    const isRefundRecovery =
      existingPayment.status === 'REFUND_PENDING' &&
      Boolean(
        refundRecord &&
        (refundRecord.status === 'PENDING' || refundRecord.status === 'FAILED'),
      );

    if (
      existingPayment.status !== 'CAPTURED' &&
      !isRefundRecovery
    ) {
      throw new BadRequestException('Payment is not eligible for a refund');
    }

    const nonRefundableBookingStatuses: BookingStatus[] = ['ARCHIVED'];
    if (nonRefundableBookingStatuses.includes(existingPayment.booking.status)) {
      throw new BadRequestException(
        `Booking cannot be refunded in status: ${existingPayment.booking.status}`,
      );
    }

    if (new Prisma.Decimal(refundAmountDecimal).gt(new Prisma.Decimal(existingPayment.booking.paidAmountUsd))) {
      throw new BadRequestException(
        'Refund amount cannot exceed total paid amount on the booking',
      );
    }

    const refundMoney = Money.fromDecimal(
      refundAmountDecimal,
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
        throw new ConflictException('Refund recovery record is missing');
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

    let refundResult: { refundId: string; status?: string };
    try {
      const gResult = await this.paymentGateway.refund(
        existingPayment.transactionId,
        refundMoney.toDecimal().toFixed(2),
        ikey,
      );
      refundResult = {
        refundId:
          (gResult as any).providerRefundId ||
          (gResult as any).refundId ||
          refundRecord.id,
        status:
          (gResult as any).providerStatus ||
          (isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED'),
      };
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
          data: isPartial
            ? {
                status: 'CAPTURED',
                isRefund: false,
                providerStatus: 'PARTIALLY_REFUNDED',
              }
            : {
                status: 'REFUNDED',
                isRefund: true,
                refundedAt: new Date(),
              },
        });
        if (finalized.count !== 1) {
          throw new ConflictException(
            'Refund state changed during finalization',
          );
        }

        const isFullRefund =
          !isPartial &&
          new Prisma.Decimal(refundMoney.toDecimal()).gte(
            new Prisma.Decimal(existingPayment.amount),
          );

        const invoice = existingPayment.invoices?.[0];
        if (invoice) {
          const snap = (invoice.snapshotJsonb as any) || {};
          const creditNotes = Array.isArray(snap.creditNotes)
            ? [...snap.creditNotes]
            : [];
          creditNotes.push({
            creditNoteNumber: `CN-${refundRecord.id.slice(0, 8).toUpperCase()}`,
            refundRecordId: refundRecord.id,
            amount: refundMoney.toDecimal().toFixed(2),
            currency: refundMoney.currency,
            issuedAt: new Date().toISOString(),
            isFullRefund,
          });
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              snapshotJsonb: {
                ...snap,
                creditNotes,
              } as unknown as Prisma.InputJsonValue,
              status: isFullRefund ? 'CREDIT_NOTE' : invoice.status,
            },
          });
        }

        const refundDecimal = new Prisma.Decimal(refundMoney.toDecimal());
        const newPaidAmount = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          new Prisma.Decimal(existingPayment.booking.paidAmountUsd).sub(
            refundDecimal,
          ),
        );
        await tx.booking.update({
          where: { id: existingPayment.booking.id },
          data: {
            paidAmountUsd: newPaidAmount,
            status: isFullRefund ? 'CANCELLED' : existingPayment.booking.status,
          },
        });
        // VULN-01 & VULN-07: Guard against double capacity release if booking was already CANCELLED
        if (
          isFullRefund &&
          existingPayment.booking.status !== 'CANCELLED' &&
          existingPayment.booking.availabilityId
        ) {
          await this.availabilityService.releaseCapacity(
            tx,
            existingPayment.booking.availabilityId,
            existingPayment.booking.adults +
              (existingPayment.booking.children ?? 0),
          );
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
        if (!isPartial && redemption && redemption.status === 'ACTIVE') {
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

        await tx.auditLog.create({
          data: {
            actorId: actor?.id || null,
            actorRole: actor?.role || null,
            action: isPartial ? 'PAYMENT_PARTIALLY_REFUNDED' : 'PAYMENT_REFUNDED',
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
      reason,
      gateway: this.paymentGateway.getProviderName(),
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
      status: isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
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

  async getPaymentStatus(
    paymentId: string,
    userId?: string,
    guestToken?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            invoice: true,
          },
        },
      },
    });

    let authorized = Boolean(
      payment && userId && payment.booking.userId === userId,
    );
    if (!authorized && payment?.booking.guestTokenHash && guestToken) {
      const guestTokenHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      const expectedHash = payment.booking.guestTokenHash;
      authorized =
        guestTokenHash.length === expectedHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(guestTokenHash, 'hex'),
          Buffer.from(expectedHash, 'hex'),
        );
    }

    if (!payment || !authorized) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      invoiceNumber: payment.booking.invoice?.invoiceNumber ?? null,
      booking: {
        id: payment.booking.id,
        referenceCode: payment.booking.referenceCode,
        status: payment.booking.status,
        totalAmountUsd: payment.booking.totalAmountUsd,
        paidAmountUsd: payment.booking.paidAmountUsd,
      },
      updatedAt: payment.updatedAt,
    };
  }
}
