import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  UpdateReviewStatusDto,
  AdminReplyReviewDto,
} from './dto/update-review-status.dto';
import { sanitizeHtmlContent } from '../../common/utils/content-sanitizer.util';
import { getPaginationParams, paginate } from '../../common/utils';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- PUBLIC / CUSTOMER API ---

  async findTourReviewsPublic(
    tourId: string,
    pageVal: number = 1,
    limitVal: number = 10,
  ) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);

    const where: Prisma.TourReviewWhereInput = {
      tourId,
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
      }),
    ]);

    const aggregates = await this.prisma.tourReview.aggregate({
      where: { tourId, isPublished: true, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const paginated = paginate(records, total, page, limit);

    return {
      ...paginated,
      ratingSummary: {
        averageRating: aggregates._avg.rating
          ? Number(aggregates._avg.rating.toFixed(2))
          : 0,
        totalReviews: aggregates._count.rating || 0,
      },
    };
  }

  async createCustomerReview(
    tourId: string,
    userId: string,
    dto: CreateReviewDto,
  ) {
    // 1. Verify booking existence
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { user: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found`);
    }

    // 2. Ownership check
    if (booking.userId !== userId) {
      throw new ForbiddenException(
        'You can only submit a review for your own booking',
      );
    }

    // 3. Tour match check
    if (booking.tourId !== tourId) {
      throw new BadRequestException(
        'Specified booking does not match this tour',
      );
    }

    // 4. Completed status check
    if (booking.status !== 'COMPLETED') {
      throw new UnprocessableEntityException(
        'Only completed bookings are eligible for reviews',
      );
    }

    // 5. One review per booking/tour duplicate check
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

    const sanitizedComment = dto.comment
      ? sanitizeHtmlContent(dto.comment)
      : null;
    const reviewerName =
      dto.reviewerName || booking.user?.name || 'Verified Traveler';

    const newReview = await this.prisma.tourReview.create({
      data: {
        tourId,
        userId,
        bookingId: dto.bookingId,
        rating: dto.rating,
        reviewerName,
        comment: sanitizedComment,
        status: 'PENDING',
        isPublished: false,
      },
    });

    return newReview;
  }

  // --- ADMIN API ---

  async findAllAdmin(
    pageVal: number = 1,
    limitVal: number = 10,
    tourId?: string,
    status?: string,
  ) {
    const { page, limit, skip } = getPaginationParams(pageVal, limitVal);

    const where: Prisma.TourReviewWhereInput = {
      deletedAt: null,
    };

    if (tourId) where.tourId = tourId;
    if (status) where.status = status;

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

  async updateStatusAdmin(
    id: string,
    dto: UpdateReviewStatusDto,
    actorId?: string,
  ) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    const isPublished =
      dto.isPublished !== undefined
        ? dto.isPublished
        : dto.status === 'APPROVED';

    const updated = await this.prisma.tourReview.update({
      where: { id },
      data: {
        status: dto.status,
        isPublished,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
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

    return updated;
  }

  async replyAdmin(id: string, dto: AdminReplyReviewDto, actorId?: string) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    const sanitizedReply = sanitizeHtmlContent(dto.adminReply);

    const updated = await this.prisma.tourReview.update({
      where: { id },
      data: { adminReply: sanitizedReply },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TOUR_REVIEW_REPLIED',
        entityType: 'TOUR_REVIEW',
        entityId: id,
      },
    });

    return updated;
  }

  async softDeleteAdmin(id: string, actorId?: string) {
    const review = await this.prisma.tourReview.findUnique({
      where: { id },
    });

    if (!review || review.deletedAt) {
      throw new NotFoundException(`Review '${id}' not found`);
    }

    await this.prisma.tourReview.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isPublished: false,
        status: 'REJECTED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TOUR_REVIEW_DELETED',
        entityType: 'TOUR_REVIEW',
        entityId: id,
      },
    });

    return { success: true, message: `Review '${id}' deleted.` };
  }
}
