export const REVIEW_EVENTS = {
  CREATED: 'review.created',
  STATUS_UPDATED: 'review.status_updated',
} as const;

export interface ReviewCreatedPayload {
  reviewId: string;
  tourId: string;
  tourSlug: string;
  tourTitle: string;
  rating: number;
  reviewerName: string;
  comment?: string | null;
  userId?: string | null;
  createdAt: Date;
}

export interface ReviewStatusUpdatedPayload {
  reviewId: string;
  tourId: string;
  oldStatus: string;
  newStatus: string;
  isPublished: boolean;
  actorId?: string;
}
