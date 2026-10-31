import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationDeliveryStatus } from '@prisma/client';
import { NotificationsService } from '../notifications.service';

export const MAX_RETRY_ATTEMPTS = 3;

@Injectable()
export class EmailRetrySchedulerService {
  private readonly logger = new Logger(EmailRetrySchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Periodic scheduler that runs every 60 seconds to process failed retryable deliveries.
   */
  @Interval(60000)
  async handleScheduledRetries(): Promise<number> {
    return this.processPendingRetries();
  }

  /**
   * Re-entrant safe execution of pending retries from the database with atomic lease claiming.
   */
  async processPendingRetries(batchSize: number = 20): Promise<number> {
    if (this.isProcessing) {
      this.logger.debug('Previous retry pass still running; skipping cycle');
      return 0;
    }

    if (!this.prisma?.notificationDeliveryLog) {
      return 0;
    }

    this.isProcessing = true;
    let processedCount = 0;

    try {
      const now = Date.now();
      // Tiered exponential backoff intervals:
      // 1st retry: after 60s
      // 2nd retry: after 180s
      // 3rd retry: after 600s
      const baseCooldown = new Date(now - 60 * 1000);

      const failedLogs = await this.prisma.notificationDeliveryLog.findMany({
        where: {
          status: NotificationDeliveryStatus.FAILED,
          attempts: { lt: MAX_RETRY_ATTEMPTS },
          OR: [
            { lastAttemptAt: null },
            { lastAttemptAt: { lt: baseCooldown } },
          ],
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' },
      });

      for (const log of failedLogs) {
        // Enforce tiered backoff based on prior attempt count
        const requiredCooldownMs =
          log.attempts === 1
            ? 60 * 1000
            : log.attempts === 2
              ? 180 * 1000
              : 600 * 1000;

        if (
          log.lastAttemptAt &&
          now - log.lastAttemptAt.getTime() < requiredCooldownMs
        ) {
          continue; // Cooldown for this tier not yet elapsed
        }

        // Atomic Mutually Exclusive Lease Claim:
        // Increment attempts atomically and update lastAttemptAt so a concurrent
        // scheduler worker or thread cannot match the same attempts counter.
        const claim = await this.prisma.notificationDeliveryLog.updateMany({
          where: {
            id: log.id,
            status: NotificationDeliveryStatus.FAILED,
            attempts: log.attempts,
          },
          data: {
            attempts: { increment: 1 },
            lastAttemptAt: new Date(now),
            failureReason: `Scheduled database retry pass initiated (attempt ${log.attempts + 1})`,
          },
        });

        // Exactly one concurrent worker wins the atomic lease claim
        if (claim.count === 1) {
          try {
            await this.notificationsService.retryNotification(log.id);
            processedCount++;
          } catch (err: any) {
            this.logger.warn(
              `Scheduled retry execution failed for log ${log.id}: ${err?.message || err}`,
            );

            // If the attempt reached the maximum limit, mark EXHAUSTED
            if (log.attempts + 1 >= MAX_RETRY_ATTEMPTS) {
              try {
                await this.prisma.notificationDeliveryLog.update({
                  where: { id: log.id },
                  data: {
                    status: NotificationDeliveryStatus.EXHAUSTED,
                    failureReason: `Exhausted after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${err?.message || err}`,
                  },
                });
              } catch (_exhaustErr) {
                // Non-blocking status update
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error during scheduled email retry run: ${err?.message || err}`,
      );
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }
}
