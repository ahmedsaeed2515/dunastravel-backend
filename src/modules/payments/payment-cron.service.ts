import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IPaymentGatewayPort)
    private readonly paymentGateway: IPaymentGatewayPort,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  @Cron('*/15 * * * *')
  async expireStalePayments() {
    this.logger.log('Starting cron job to expire stale pending payments...');

    const thresholdDate = new Date(Date.now() - 30 * 60 * 1000);

    const stalePayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        isRefund: false,
        OR: [
          { expiresAt: { lte: new Date() } },
          { expiresAt: null, createdAt: { lt: thresholdDate } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    if (stalePayments.length === 0) {
      this.logger.log('No stale pending payments found.');
      return;
    }

    this.logger.log(
      `Found ${stalePayments.length} stale pending payments. Expiring them...`,
    );

    let expiredCount = 0;
    for (const paymentData of stalePayments) {
      try {
        if (paymentData.transactionId) {
          try {
            const providerState = await this.paymentGateway.checkStatus(
              paymentData.transactionId,
            );
            if (providerState.providerStatus.toUpperCase() === 'PAID') {
              this.logger.log(
                `Payment ${paymentData.id} found PAID on PayLink during expiry check. Reconciling...`,
              );
              await this.paymentsService.reconcilePaymentByProviderInvoiceId(
                paymentData.transactionId,
              );
              continue;
            }
          } catch {
            this.logger.warn(
              `PayLink status could not be checked for paymentId=${paymentData.id}; internal state was left unchanged`,
            );
            continue;
          }
        }

        const claimed = await this.prisma.$transaction(async (tx) => {
          const paymentClaim = await tx.payment.updateMany({
            where: {
              id: paymentData.id,
              status: 'PENDING',
              isRefund: false,
              OR: [
                { expiresAt: { lte: new Date() } },
                { expiresAt: null, createdAt: { lt: thresholdDate } },
              ],
            },
            data: { status: 'EXPIRED', expiresAt: new Date() },
          });
          if (paymentClaim.count !== 1) return false;

          const booking = await tx.booking.findUnique({
            where: { id: paymentData.bookingId },
            include: { promotionRedemption: true },
          });
          if (booking) {
            // Expiring an online checkout only expires that attempt. The
            // booking and its existing availability reservation remain valid
            // for an explicit retry or cancellation; payment expiry is not a
            // customer cancellation.
            await tx.bookingActivityLog.create({
              data: {
                bookingId: booking.id,
                action: 'PAYMENT_EXPIRED',
                details: { paymentId: paymentData.id },
              },
            });
          }
          return true;
        });

        if (!claimed) continue;

        expiredCount++;
      } catch {
        this.logger.error('Failed to expire a stale pending payment');
      }
    }

    this.logger.log(`Successfully expired ${expiredCount} stale payments.`);
  }

  @Cron('*/10 * * * *')
  async reconcilePendingPayments() {
    // Bounded check for open pending payments created at least 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const pending = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        isRefund: false,
        transactionId: { not: null },
        createdAt: { lt: fiveMinutesAgo, gte: thirtyMinutesAgo },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (pending.length === 0) return;

    this.logger.log(`Reconciling ${pending.length} pending payments with PayLink...`);
    for (const p of pending) {
      if (!p.transactionId) continue;
      try {
        await this.paymentsService.reconcilePaymentByProviderInvoiceId(p.transactionId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to reconcile payment ${p.id} (tx: ${p.transactionId}): ${msg}`);
      }
    }
  }

  @Cron('*/10 * * * *')
  async reconcileStuckRefunds() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const stuckRefunds = await this.prisma.payment.findMany({
      where: {
        status: 'REFUND_PENDING',
        updatedAt: { lt: fiveMinutesAgo },
      },
      take: 50,
    });

    if (stuckRefunds.length === 0) return;

    this.logger.log(`Reconciling ${stuckRefunds.length} stuck REFUND_PENDING payments with PayLink...`);
    for (const p of stuckRefunds) {
      const transactionId = p.providerPaymentId || p.transactionId;
      if (!transactionId) continue;
      try {
        const providerState = await this.paymentGateway.checkStatus(transactionId);
        const statusUpper = providerState.providerStatus.toUpperCase();
        if (['REFUNDED', 'VOIDED', 'REVERSED'].includes(statusUpper)) {
          this.logger.log(
            `Payment ${p.id} verified as ${statusUpper} on PayLink. Finalizing local refund state...`,
          );
          await this.paymentsService.reconcilePaymentByProviderInvoiceId(transactionId, {
            id: p.id,
            bookingId: p.bookingId,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to reconcile stuck refund for payment ${p.id}: ${msg}`);
      }
    }
  }
}
