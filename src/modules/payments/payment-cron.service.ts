import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentEntity } from './domain/payment.entity';
import { Money } from '../../common/domain/value-objects/money.vo';

import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { Inject } from '@nestjs/common';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IPaymentGatewayPort)
    private readonly paymentGateway: IPaymentGatewayPort,
  ) {}

  @Cron('*/15 * * * *')
  async expireStalePayments() {
    this.logger.log('Starting cron job to expire stale pending payments...');

    // threshold: 30 minutes ago
    const thresholdDate = new Date(Date.now() - 30 * 60 * 1000);

    const stalePayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: thresholdDate,
        },
      },
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
        await this.prisma.$transaction(async (tx) => {
          const entity = new PaymentEntity(
            paymentData.id,
            paymentData.bookingId,
            Money.fromDecimal(
              paymentData.amount.toNumber(),
              paymentData.currency,
            ),
            paymentData.method,
            paymentData.transactionId,
            paymentData.status,
            paymentData.createdAt,
          );

          entity.expire();

          await tx.payment.update({
            where: { id: paymentData.id },
            data: { status: entity.status },
          });

          if (paymentData.transactionId) {
            await this.paymentGateway.expireSession(paymentData.transactionId);
          }

          // Also cancel the associated booking hold if it's still PENDING
          const booking = await tx.booking.findUnique({
            where: { id: paymentData.bookingId },
          });
          if (booking && booking.status === 'PENDING') {
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CANCELLED',
                cancellationReason:
                  'Payment expired automatically after 30 minutes of inactivity',
              },
            });
            // Depending on the domain, we might also restore tour capacity here.
            // If the booking creation deducted remainingSeats, we would increment them back.
            await tx.tour.update({
              where: { id: booking.tourId },
              data: {
                remainingSeats: {
                  increment: booking.adults + booking.children,
                },
              },
            });
          }
        });
        expiredCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to expire payment ${paymentData.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Successfully expired ${expiredCount} stale payments.`);
  }
}
