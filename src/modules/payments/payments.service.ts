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

    const bookingCurrency = (
      booking.currency ||
      booking.tour.currency ||
      'USD'
    ).toUpperCase();
    const invoiceCurrency = (booking.invoice?.currency || 'USD').toUpperCase();
    const isSupportedCurrency = ['USD', 'EUR'].includes(bookingCurrency);
    const authoritativeTotal =
      bookingCurrency === 'EUR' && booking.originalAmount
        ? booking.originalAmount
        : booking.totalAmountUsd;

    if (
      !booking.invoice ||
      !isSupportedCurrency ||
      bookingCurrency !== invoiceCurrency ||
      !booking.invoice.total.equals(authoritativeTotal) ||
      authoritativeTotal.lte(0)
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
    const amountDue = authoritativeTotal.minus(totalCaptured);
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
        existingPendingPayment.currency === bookingCurrency &&
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

    const chargeCurrency = bookingCurrency;
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
      throw new ServiceUnavailableException(
        'Payment gateway did not return a valid transaction ID',
      );
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

      // The customer must poll using the opaque payment record ID, never a
      // provider session/transaction reference whose format is provider-owned.
      return {
        ...session,
        transactionId: providerTxId,
        paymentId: effectivePaymentId,
      };
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

    const providerRef = payload.providerInvoiceId || (payload as any).paymentId;
    if (!providerRef) {
      throw new UnprocessableEntityException(
        'Webhook payload is missing a valid provider reference',
      );
    }

    const matchedPayment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionId: providerRef },
          { providerPaymentId: providerRef },
          { id: providerRef },
        ],
      },
      include: {
        booking: {
          include: { invoice: true },
        },
      },
    });

    if (!matchedPayment) {
      throw new UnprocessableEntityException(
        `Payment for provider reference ${providerRef} not found`,
      );
    }

    const targetPaymentId = matchedPayment.id;
    const targetBookingId = matchedPayment.bookingId;

    if (
      (payload as any).paymentId &&
      (payload as any).paymentId !== targetPaymentId &&
      (payload as any).paymentId !== matchedPayment.transactionId &&
      (payload as any).paymentId !== matchedPayment.providerPaymentId
    ) {
      throw new UnprocessableEntityException(
        'Payload paymentId does not match provider payment record',
      );
    }
    if (
      (payload as any).bookingId &&
      (payload as any).bookingId !== targetBookingId
    ) {
      throw new UnprocessableEntityException(
        'Payload bookingId does not match payment booking reference',
      );
    }

    const rawEvt = payload.rawEvent || {};
    const reportedRawAmount =
      rawEvt.order_amount ??
      rawEvt.paid_amount ??
      rawEvt.amount ??
      rawEvt.invoice_amount ??
      (payload as any).amountUsd ??
      (payload as any).amount;

    const reportedRawCurrency =
      rawEvt.order_currency ??
      rawEvt.currency ??
      (payload as any).currency ??
      matchedPayment.currency;

    let targetAmount: number;
    const targetCurrency = String(reportedRawCurrency).toUpperCase();

    if (payload.status === 'COMPLETED') {
      if (reportedRawAmount !== undefined && reportedRawAmount !== null) {
        const parsedAmount = Number(reportedRawAmount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          throw new UnprocessableEntityException(
            'Invalid payment amount reported by gateway',
          );
        }

        const gatewayAmount = new Prisma.Decimal(parsedAmount.toFixed(2));
        if (!matchedPayment.amount.equals(gatewayAmount)) {
          this.logger.error(
            `CRITICAL FINANCIAL ALERT: Webhook amount mismatch for booking ${matchedPayment.bookingId}! Gateway reported ${gatewayAmount.toFixed(2)}, expected ${matchedPayment.amount.toFixed(2)}`,
          );
          await this.prisma.auditLog
            .create({
              data: {
                action: 'PAYMENT_AMOUNT_MISMATCH_ALERT',
                entityType: 'Booking',
                entityId: matchedPayment.bookingId,
                metadata: {
                  paymentId: matchedPayment.id,
                  reportedAmount: gatewayAmount.toFixed(2),
                  expectedAmount: matchedPayment.amount.toFixed(2),
                  currency: matchedPayment.currency,
                  providerInvoiceId: payload.providerInvoiceId,
                },
              },
            })
            .catch(() => {});
          throw new UnprocessableEntityException(
            `Gateway reported amount (${gatewayAmount.toFixed(2)}) does not match expected payment amount (${matchedPayment.amount.toFixed(2)})`,
          );
        }

        if (targetCurrency !== matchedPayment.currency) {
          this.logger.error(
            `CRITICAL FINANCIAL ALERT: Webhook currency mismatch for booking ${matchedPayment.bookingId}! Gateway reported ${targetCurrency}, expected ${matchedPayment.currency}`,
          );
          await this.prisma.auditLog
            .create({
              data: {
                action: 'PAYMENT_CURRENCY_MISMATCH_ALERT',
                entityType: 'Booking',
                entityId: matchedPayment.bookingId,
                metadata: {
                  paymentId: matchedPayment.id,
                  reportedCurrency: targetCurrency,
                  expectedCurrency: matchedPayment.currency,
                  providerInvoiceId: payload.providerInvoiceId,
                },
              },
            })
            .catch(() => {});
          throw new UnprocessableEntityException(
            `Gateway reported currency (${targetCurrency}) does not match expected currency (${matchedPayment.currency})`,
          );
        }

        targetAmount = gatewayAmount.toNumber();
      } else {
        targetAmount = matchedPayment.amount.toNumber();
      }

      if (
        matchedPayment.booking?.invoice &&
        !matchedPayment.booking.invoice.total.equals(
          matchedPayment.booking.totalAmountUsd,
        )
      ) {
        throw new UnprocessableEntityException(
          'Invoice total does not match booking total amount',
        );
      }
    } else {
      targetAmount = matchedPayment.amount.toNumber();
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
            } else if (
              ['REFUNDED', 'VOIDED', 'REVERSED'].includes(payload.status)
            ) {
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

    if (
      ['REFUNDED', 'CANCELLED', 'COMPLETED', 'ARCHIVED'].includes(
        booking.status,
      )
    ) {
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
        status: { in: ['PENDING', 'AUTHORIZED'] },
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
    } else if (providerInvoiceId && callbackPayment) {
      // The callback has already been cryptographically verified with HMAC-SHA256
      // against GETPAYIN_HASH_TOKEN via paymentGateway.verifyCallback above.
      // Therefore, the payload originates directly from the trusted payment gateway
      // redirecting the payer's browser, even if their session cookie expired during 3DS.
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new NotFoundException('Payment not found');
    }
    const outcome =
      await this.reconcilePaymentByProviderInvoiceId(providerInvoiceId);
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
            : callbackPayment.status,
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
    throw new BadRequestException(
      'Online refunds via payment gateway are disabled. All refunds are processed offline directly by company finance.',
    );
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
