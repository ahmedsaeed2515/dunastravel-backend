import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { REVIEW_EVENTS, ReviewCreatedPayload } from '../../../common/events';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
} from '@prisma/client';

@Injectable()
export class ReviewCreatedListener {
  private readonly logger = new Logger(ReviewCreatedListener.name);

  constructor(private readonly inAppNotifications: InAppNotificationsService) {}

  @OnEvent(REVIEW_EVENTS.CREATED, { async: true })
  async handleReviewCreatedEvent(payload: ReviewCreatedPayload) {
    if (!payload?.reviewId || !payload?.tourId) {
      this.logger.error(
        'Malformed review.created payload received, skipping. Missing reviewId or tourId.',
      );
      return;
    }

    this.logger.log(
      `Received review.created event for review: ${payload.reviewId}, tour: ${payload.tourSlug} (${payload.tourTitle}) by ${payload.reviewerName}`,
    );

    try {
      const reviewer = payload.reviewerName || 'A verified traveler';
      const tourTitle = payload.tourTitle || 'Luxury Tour';
      const rating = payload.rating || 5;

      await this.inAppNotifications.notifyAdmins({
        category: InAppNotificationCategory.TOUR,
        priority: InAppNotificationPriority.NORMAL,
        title: 'New Trip Review',
        message: `${reviewer} rated "${tourTitle}" ${rating} stars.`,
        entityType: 'TOUR_REVIEW',
        entityId: payload.reviewId,
        deepLink: `/admin/reviews?reviewId=${payload.reviewId}`,
        metadata: {
          reviewId: payload.reviewId,
          tourId: payload.tourId,
          tourSlug: payload.tourSlug,
          tourTitle,
          rating,
          reviewerName: reviewer,
          comment: payload.comment || null,
          userId: payload.userId || null,
          createdAt: payload.createdAt,
        },
      });

      this.logger.log(
        `Successfully created admin in-app notification for review: ${payload.reviewId}`,
      );
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to deliver admin notification for review ${payload.reviewId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
