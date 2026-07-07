import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_EVENTS } from '../../common/events/payment-events';
import { Money } from '../../common/domain/value-objects/money.vo';
import { PaymentEntity } from './domain/payment.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IPaymentGatewayPort) private readonly paymentGateway: IPaymentGatewayPort,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initiatePayment(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tour: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new BadRequestException(`Booking is in ${booking.status} status and cannot be paid.`);
    }

    const money = Money.fromDecimal(booking.totalAmountUsd.toNumber(), 'USD');

    let session;
    try {
      session = await this.paymentGateway.createSession(
        booking.id,
        money.toDecimal(),
        money.currency,
        booking.referenceCode,
      );
    } catch (error: any) {
      this.logger.error(`Failed to create payment session for bookingId=${bookingId} ref=${booking.referenceCode}: ${error.message}`);
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
        new Date()
      );

      // Ensure there is a PENDING payment record
      await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: money.toDecimal(),
          currency: money.currency,
          method: this.paymentGateway.getProviderName(),
          transactionId: session.transactionId,
          status: mockEntity.status,
        },
      });

      this.eventEmitter.emit(PAYMENT_EVENTS.INITIATED, {
        paymentId: session.transactionId,
        bookingId: booking.id,
        amountUsd: money.toDecimal(),
        gateway: this.paymentGateway.getProviderName(),
      });

      this.logger.log(`Payment initiated for booking ${booking.id} with transactionId ${session.transactionId}`);
      return session;
    } catch (error: any) {
      this.logger.error(`Database failure during initiatePayment for bookingId=${bookingId} ref=${booking.referenceCode}, rolling back transactionId=${session.transactionId}. Error: ${error.message}`);
      
      // Compensating action: refund/cancel the session
      try {
        await this.paymentGateway.refund(session.transactionId);
        this.logger.log(`Successfully executed compensating refund for transactionId=${session.transactionId}`);
      } catch (refundError: any) {
        this.logger.error(`CRITICAL: Failed to execute compensating refund for transactionId=${session.transactionId} after DB failure. Manual intervention required. Error: ${refundError.message}`);
      }

      throw error;
    }
  }

  async handleWebhook(req: any, rawBody: Buffer) {
    const payload = await this.paymentGateway.verifyAndParseWebhook(req, rawBody);
    const provider = this.paymentGateway.getProviderName();

    // STRIPE RETRY SEMANTICS:
    // If we return anything other than a 2xx status code (e.g. 400 Bad Request),
    // Stripe will forcefully retry the exact same malformed payload for up to 3 days
    // with exponential backoff. Because a missing eventId is a fatal edge-case that 
    // cannot be "fixed" on retry, throwing an exception here would cause an endless 
    // retry storm and spam our logs. Thus, we log a critical error but return a 
    // silent 200 OK to immediately terminate Stripe's retry loop.
    if (!payload.eventId) {
      this.logger.error(`Webhook payload missing eventId, cannot guarantee idempotency. Rejecting silently (200) to prevent Stripe retry storms.`);
      return { received: true };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (payload.eventId) {
          const existingEvent = await tx.processedWebhookEvent.findUnique({
            where: { id: payload.eventId },
          });

          if (existingEvent) {
            this.logger.log(`Webhook event ${payload.eventId} already processed. Returning 200.`);
            return;
          }
        }

        if (payload.status === 'COMPLETED') {
          await this.handleSuccessfulPaymentTx(tx, payload.bookingId, payload.amountUsd, payload.paymentId);
        } else {
          this.logger.log(`Unhandled or pending payment status: ${payload.status} for booking ${payload.bookingId}`);
        }

        if (payload.eventId) {
          await tx.processedWebhookEvent.create({
            data: {
              id: payload.eventId,
              provider,
              payload: payload.rawEvent,
            },
          });
        }
      }, { isolationLevel: 'Serializable' });
    } catch (error: any) {
      if (error.code === 'P2002' || error.code === 'P2034') {
        this.logger.log(`Webhook event ${payload.eventId} concurrently processed (code: ${error.code}). Returning 200.`);
        return { received: true };
      }
      throw error;
    }

    return { received: true };
  }

  private async handleSuccessfulPaymentTx(tx: any, bookingId: string, amountUsd: number, transactionId: string) {
    if (!bookingId) {
      this.logger.warn('Received successful payment without bookingId');
      return;
    }

    const money = Money.fromDecimal(amountUsd, 'USD');

    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found during payment fulfillment`);
    }

    // We will update the booking status AFTER we create/update the payment record.

    // Update the pending payment or create a new one
    const existingPayment = await tx.payment.findFirst({
      where: { bookingId, transactionId },
    });

    let payment;
    if (existingPayment) {
      const paymentEntity = new PaymentEntity(
        existingPayment.id,
        existingPayment.bookingId,
        Money.fromDecimal(existingPayment.amount.toNumber(), existingPayment.currency),
        existingPayment.method,
        existingPayment.transactionId,
        existingPayment.status as any,
        existingPayment.createdAt,
      );
      paymentEntity.markCaptured();

      payment = await tx.payment.update({
        where: { id: existingPayment.id },
        data: { status: paymentEntity.status },
      });
    } else {
      // For a new payment created during webhook fulfillment (e.g. captured immediately)
      const mockEntity = new PaymentEntity(
        'mock-id',
        bookingId,
        money,
        this.paymentGateway.getProviderName(),
        transactionId,
        'PENDING',
        new Date()
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
      where: { bookingId, status: 'CAPTURED' }
    });

    const totalCaptured = allCapturedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const newStatus = totalCaptured >= Number(booking.totalAmountUsd) ? 'PAID' : 'PARTIALLY_PAID';

    await tx.booking.update({
      where: { id: bookingId },
      data: { 
        status: newStatus,
        paidAmountUsd: totalCaptured 
      },
    });

    this.logger.log(`Payment successful and captured for booking ${bookingId}. Total captured: ${totalCaptured}. Status updated to ${newStatus}.`);

    this.eventEmitter.emit(PAYMENT_EVENTS.SUCCEEDED, {
      paymentId: payment.id,
      bookingId: bookingId,
      amountUsd: money.toDecimal(),
      transactionId: transactionId,
      gateway: this.paymentGateway.getProviderName(),
    });
  }

  async refundPayment(paymentId: string, amount?: number) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const paymentEntity = new PaymentEntity(
      existingPayment.id,
      existingPayment.bookingId,
      Money.fromDecimal(existingPayment.amount.toNumber(), existingPayment.currency),
      existingPayment.method,
      existingPayment.transactionId,
      existingPayment.status as any,
      existingPayment.createdAt,
    );

    // Enforce full refund only (known limitation due to missing amountRefunded schema)
    if (amount !== undefined && amount !== paymentEntity.money.toDecimal()) {
      throw new BadRequestException('Partial refunds are not currently supported. You must refund the full amount.');
    }

    const refundMoney = Money.fromDecimal(
      paymentEntity.money.toDecimal(),
      existingPayment.currency
    );

    // This validates state and currency
    paymentEntity.markRefunded(refundMoney);

    if (!existingPayment.transactionId) {
      throw new BadRequestException('Cannot refund a payment without a transactionId');
    }

    const { refundId } = await this.paymentGateway.refund(existingPayment.transactionId, amount);

    const updatedPayment = await this.prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: paymentEntity.status,
        isRefund: true,
      },
    });

    this.eventEmitter.emit(PAYMENT_EVENTS.REFUNDED, {
      paymentId: existingPayment.id,
      bookingId: existingPayment.bookingId,
      amount: refundMoney.toDecimal(),
      currency: refundMoney.currency,
      refundId,
    });

    this.logger.log(`Refund ${refundId} issued for payment ${existingPayment.id} (booking ${existingPayment.bookingId})`);

    return { success: true, refundId, status: paymentEntity.status };
  }

  async getPaymentStatus(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    // Verify ownership
    if (payment.booking.userId !== userId) {
      throw new NotFoundException(`Payment ${paymentId} not found`); // Mask unauthorized as not found
    }

    return {
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      updatedAt: payment.updatedAt,
    };
  }
}
