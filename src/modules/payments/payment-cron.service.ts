import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';

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

    const thresholdDate = new Date(Date.now() - 30 * 60 * 1000);

    const stalePayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: thresholdDate,
        },
      },
      include: {
        booking: {
          include: {
            promotionRedemption: true,
          },
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
          await tx.payment.update({
            where: { id: paymentData.id },
            data: { status: 'EXPIRED' },
          });

          const booking = paymentData.booking;
          if (booking && booking.status === 'PENDING') {
            await tx.booking.update({
              where: { id: booking.id },
              data: {
                status: 'CANCELLED',
                cancellationReason:
                  'Payment expired automatically after 30 minutes of inactivity',
              },
            });

            if (booking.availabilityId) {
              const totalPassengers = booking.adults + booking.children;
              await tx.tourAvailability.update({
                where: { id: booking.availabilityId },
                data: {
                  remainingSeats: { increment: totalPassengers },
                  status: 'AVAILABLE',
                },
              });
            }

            if (
              booking.promotionRedemption &&
              booking.promotionRedemption.status === 'ACTIVE'
            ) {
              await tx.promotionRedemption.update({
                where: { id: booking.promotionRedemption.id },
                data: {
                  status: 'REVERSED',
                  reversedAt: new Date(),
                },
              });
              await tx.promotion.update({
                where: { id: booking.promotionRedemption.promotionId },
                data: { currentUses: { decrement: 1 } },
              });
            }
          }
        });

        if (paymentData.transactionId) {
          try {
            await this.paymentGateway.expireSession(paymentData.transactionId);
          } catch (expErr: unknown) {
            const msg =
              expErr instanceof Error
                ? expErr.message
                : 'Unknown gateway error';
            this.logger.warn(
              `Failed to expire gateway session ${paymentData.transactionId}: ${msg}`,
            );
          }
        }

        expiredCount++;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to expire payment ${paymentData.id}: ${msg}`);
      }
    }

    this.logger.log(`Successfully expired ${expiredCount} stale payments.`);
  }
}
