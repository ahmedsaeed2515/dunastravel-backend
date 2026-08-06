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
        isRefund: false,
        createdAt: {
          lt: thresholdDate,
        },
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
            await this.paymentGateway.expireSession(
              paymentData.transactionId,
            );
          } catch {
            this.logger.warn(
              'Gateway session could not be expired; internal payment state was left unchanged',
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
              createdAt: { lt: thresholdDate },
            },
            data: { status: 'EXPIRED' },
          });
          if (paymentClaim.count !== 1) return false;

          const booking = await tx.booking.findUnique({
            where: { id: paymentData.bookingId },
            include: { promotionRedemption: true },
          });
          if (booking) {
            const bookingClaim = await tx.booking.updateMany({
              where: { id: booking.id, status: 'PENDING' },
              data: {
                status: 'CANCELLED',
                cancellationReason:
                  'Payment expired automatically after 30 minutes of inactivity',
              },
            });

            if (bookingClaim.count === 1 && booking.availabilityId) {
              const totalPassengers = booking.adults + booking.children;
              await tx.$executeRaw`
                UPDATE tour_availability
                SET remaining_seats = LEAST(
                      total_capacity,
                      remaining_seats + ${totalPassengers}
                    ),
                    status = 'AVAILABLE',
                    updated_at = NOW()
                WHERE id = ${booking.availabilityId}
              `;
            }

            if (
              bookingClaim.count === 1 &&
              booking.promotionRedemption &&
              booking.promotionRedemption.status === 'ACTIVE'
            ) {
              const redemptionClaim =
                await tx.promotionRedemption.updateMany({
                where: {
                  id: booking.promotionRedemption.id,
                  status: 'ACTIVE',
                },
                data: {
                  status: 'REVERSED',
                  reversedAt: new Date(),
                },
              });
              if (redemptionClaim.count === 1) {
                await tx.$executeRaw`
                  UPDATE promotions
                  SET current_uses = GREATEST(0, current_uses - 1),
                      updated_at = NOW()
                  WHERE id = ${booking.promotionRedemption.promotionId}
                `;
              }
            }
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
}
