import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateReviewDto,
  AdminCreateReviewDto,
  AdminUpdateReviewDto,
} from './dto/create-review.dto';
import {
  UpdateReviewStatusDto,
  AdminReplyReviewDto,
  BatchUpdateReviewStatusDto,
} from './dto/update-review-status.dto';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';
import { AuthenticatedUser } from '../../common/types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Resolves a tour ID from either a UUID or a slug.
   */
  private async resolveTourId(tourIdOrSlug: string): Promise<string> {
    if (!tourIdOrSlug) {
      throw new BadRequestException('Tour identifier is required');
    }

    if (UUID_REGEX.test(tourIdOrSlug)) {
      if (this.prisma?.tour?.findUnique) {
        const tour = await this.prisma.tour.findUnique({
          where: { id: tourIdOrSlug },
          select: { id: true },
        });
        if (tour) return tour.id;
      }
      return tourIdOrSlug;
    }

    if (this.prisma?.tour?.findFirst) {
      const tourBySlug = await this.prisma.tour.findFirst({
        where: { slug: tourIdOrSlug, deletedAt: null },
        select: { id: true },
      });
      if (tourBySlug) return tourBySlug.id;
    }

    throw new NotFoundException(`Tour "${tourIdOrSlug}" not found`);
  }

  /**
   * Recalculates average rating and review count directly on the Tour entity.
   */
  private async recalculateTourRating(
    tourId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;
    try {
      const agg = await client.tourReview.aggregate({
        where: {
          tourId,
          isPublished: true,
          status: 'APPROVED',
          deletedAt: null,
        },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const avgRating = agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 5.0;
      const count = agg._count.rating || 0;

      await client.tour.updateMany({
        where: { id: tourId },
        data: {
          sourceRating: avgRating.toString(),
          sourceReviewCount: count,
        },
      });
    } catch {
      // Safe non-blocking recalculation
    }
  }

  // --- PUBLIC / CUSTOMER API ---

  async findTourReviewsPublic(
    tourIdOrSlug: string,
    pageVal: number = 1,
    limitVal: number = 10,
  ) {
    const tourId = await this.resolveTourId(tourIdOrSlug);
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);

    const where: Prisma.TourReviewWhereInput = {
      tourId,
      status: 'APPROVED',
      isPublished: true,
      deletedAt: null,
    };

    const [total, records] = await Promise.all([
      this.prisma.tourReview.count({ where }),
      this.prisma.tourReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          tourId: true,
          rating: true,
          reviewerName: true,
          comment: true,
          adminReply: true,
          createdAt: true,
        },
      }),
    ]);

    const aggregates = await this.prisma.tourReview.aggregate({
      where: {
        tourId,
        status: 'APPROVED',
        isPublished: true,
        deletedAt: null,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      items: records,
      meta: paginate(records, total, page, limit).meta,
      ratingSummary: {
        averageRating: aggregates._avg.rating
          ? Number(aggregates._avg.rating.toFixed(2))
          : 0,
        totalReviews: aggregates._count.rating || 0,
      },
    };
  }

  async createCustomerReview(
    tourIdOrSlug: string,
    user: AuthenticatedUser | null,
    dto: CreateReviewDto,
  ) {
    const tourId = await this.resolveTourId(tourIdOrSlug);

    // If verified booking ID provided, validate eligibility
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        select: {
          id: true,
          userId: true,
          tourId: true,
          status: true,
          deletedAt: true,
          user: { select: { name: true, email: true } },
        },
      });

      if (!booking || booking.deletedAt) {
        throw new NotFoundException('Booking not found');
      }

      if (user && booking.userId !== user.id) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.tourId !== tourId) {
        throw new BadRequestException(
          'Specified booking does not match this tour',
        );
      }

      const existingReview = await this.prisma.tourReview.findFirst({
        where: {
          bookingId: dto.bookingId,
          deletedAt: null,
        },
      });

      if (existingReview) {
        throw new ConflictException(
          'A review has already been submitted for this booking',
        );
      }
    }

    const sanitizedComment = dto.comment
      ? sanitizePlainText(dto.comment).slice(0, 5_000)
      : null;
    const rawName =
      (dto.reviewerName && dto.reviewerName.trim()) ||
      user?.name ||
      (user ? 'Verified Traveler' : 'Guest Traveler');
    const reviewerName = sanitizePlainText(rawName).slice(0, 100);

    const created = await this.prisma.tourReview.create({
      data: {
        tourId,
        userId: user?.id || null,
        bookingId: dto.bookingId || null,
        rating: Math.min(5, Math.max(1, Number(dto.rating) || 5)),
        reviewerName,
        comment: sanitizedComment,
        status: 'PENDING',
        isPublished: false,
      },
    });

    return created;
  }

  // --- ADMIN API ---

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 10,
    tourIdOrSlug?: string,
    status?: string,
    isPublished?: boolean,
    search?: string,
    rating?: number,
  ) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);

    const where: Prisma.TourReviewWhereInput = {
      deletedAt: null,
    };

    if (tourIdOrSlug) {
      try {
        where.tourId = await this.resolveTourId(tourIdOrSlug);
      } catch {
        where.tourId = tourIdOrSlug;
      }
    }

    if (status) where.status = status;
    if (isPublished !== undefined) where.isPublished = isPublished;
    if (rating !== undefined && rating >= 1 && rating <= 5) {
      where.rating = rating;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { reviewerName: { contains: q, mode: 'insensitive' } },
        { comment: { contains: q, mode: 'insensitive' } },
        { adminReply: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.tourReview.count({ where }),
      this.prisma.tourReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async createAdminReview(dto: AdminCreateReviewDto, actor: AuthenticatedUser) {
    const tourId = await this.resolveTourId(dto.tourId);
    const sanitizedComment = dto.comment
      ? sanitizePlainText(dto.comment).slice(0, 5_000)
      : null;
    const sanitizedReply = dto.adminReply
      ? sanitizePlainText(dto.adminReply).slice(0, 2_000)
      : null;
    const reviewerName = sanitizePlainText(dto.reviewerName).slice(0, 100);
    const status = dto.status || 'APPROVED';
    const isPublished =
      dto.isPublished !== undefined
        ? dto.isPublished
        : status === 'APPROVED';

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.tourReview.create({
        data: {
          tourId,
          userId: actor.id,
          rating: Math.min(5, Math.max(1, Number(dto.rating) || 5)),
          reviewerName,
          comment: sanitizedComment,
          adminReply: sanitizedReply,
          status,
          isPublished,
        },
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEW_CREATED_ADMIN',
          entityType: 'TOUR_REVIEW',
          entityId: review.id,
          metadata: {
            tourId,
            rating: review.rating,
            reviewerName,
            status,
            isPublished,
          },
        },
      });

      await this.recalculateTourRating(tourId, tx);

      return review;
    });
  }

  async updateAdminReview(
    id: string,
    dto: AdminUpdateReviewDto,
    actor: AuthenticatedUser,
  ) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    const data: Prisma.TourReviewUpdateInput = {};

    if (dto.tourId) {
      data.tour = { connect: { id: await this.resolveTourId(dto.tourId) } };
    }
    if (dto.reviewerName !== undefined) {
      data.reviewerName = sanitizePlainText(dto.reviewerName).slice(0, 100);
    }
    if (dto.rating !== undefined) {
      data.rating = Math.min(5, Math.max(1, Number(dto.rating) || 5));
    }
    if (dto.comment !== undefined) {
      data.comment = dto.comment
        ? sanitizePlainText(dto.comment).slice(0, 5_000)
        : null;
    }
    if (dto.adminReply !== undefined) {
      data.adminReply = dto.adminReply
        ? sanitizePlainText(dto.adminReply).slice(0, 2_000)
        : null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tourReview.update({
        where: { id },
        data,
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEW_UPDATED_ADMIN',
          entityType: 'TOUR_REVIEW',
          entityId: id,
          metadata: {
            changes: JSON.parse(JSON.stringify(dto)),
          },
        },
      });

      await this.recalculateTourRating(updated.tourId, tx);

      return updated;
    });
  }

  async updateStatusAdmin(
    id: string,
    dto: UpdateReviewStatusDto,
    actor: AuthenticatedUser,
  ) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    const isPublished =
      dto.status === 'APPROVED' && dto.isPublished !== false;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tourReview.update({
        where: { id },
        data: {
          status: dto.status,
          isPublished,
        },
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEW_STATUS_UPDATED',
          entityType: 'TOUR_REVIEW',
          entityId: id,
          metadata: {
            oldStatus: review.status,
            newStatus: dto.status,
            isPublished,
          },
        },
      });

      await this.recalculateTourRating(review.tourId, tx);

      return updated;
    });
  }

  async batchUpdateStatusAdmin(
    dto: BatchUpdateReviewStatusDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.reviewIds || !Array.isArray(dto.reviewIds) || dto.reviewIds.length === 0) {
      throw new BadRequestException('At least one review ID must be provided');
    }

    const isPublished =
      dto.status === 'APPROVED' && dto.isPublished !== false;

    return this.prisma.$transaction(async (tx) => {
      const existingReviews = await tx.tourReview.findMany({
        where: {
          id: { in: dto.reviewIds },
          deletedAt: null,
        },
        select: { id: true, tourId: true, status: true },
      });

      if (existingReviews.length === 0) {
        throw new NotFoundException('No matching active reviews found');
      }

      await tx.tourReview.updateMany({
        where: {
          id: { in: existingReviews.map((r) => r.id) },
        },
        data: {
          status: dto.status,
          isPublished,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEWS_BATCH_STATUS_UPDATED',
          entityType: 'TOUR_REVIEW',
          metadata: {
            count: existingReviews.length,
            reviewIds: existingReviews.map((r) => r.id),
            newStatus: dto.status,
            isPublished,
          },
        },
      });

      const uniqueTourIds = Array.from(new Set(existingReviews.map((r) => r.tourId)));
      for (const tourId of uniqueTourIds) {
        await this.recalculateTourRating(tourId, tx);
      }

      return {
        success: true,
        count: existingReviews.length,
        status: dto.status,
        isPublished,
      };
    });
  }

  async replyAdmin(
    id: string,
    dto: AdminReplyReviewDto,
    actor: AuthenticatedUser,
  ) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    const sanitizedReply = sanitizePlainText(dto.adminReply).slice(0, 2_000);
    if (!sanitizedReply) {
      throw new BadRequestException('Reply cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tourReview.update({
        where: { id },
        data: { adminReply: sanitizedReply },
        include: {
          tour: { select: { id: true, slug: true, titleJsonb: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEW_REPLIED',
          entityType: 'TOUR_REVIEW',
          entityId: id,
        },
      });

      return updated;
    });
  }

  async softDeleteAdmin(id: string, actor: AuthenticatedUser) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tourReview.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isPublished: false,
          status: 'REJECTED',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TOUR_REVIEW_DELETED',
          entityType: 'TOUR_REVIEW',
          entityId: id,
        },
      });

      await this.recalculateTourRating(review.tourId, tx);
    });

    return { success: true, message: `Review '${id}' deleted.` };
  }
}

