import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminReviewsService {
  private readonly logger = new Logger(AdminReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listReviews(isPublished?: boolean) {
    const where = isPublished !== undefined ? { isPublished } : {};
    return this.prisma.tourReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tour: { select: { slug: true } }
      }
    });
  }

  async publishReview(id: string, adminUserId: string) {
    const review = await this.prisma.tourReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.tourReview.update({
      where: { id },
      data: { isPublished: true },
    });

    this.logger.log(`Review ${id} published by admin ${adminUserId}`);
    return updated;
  }

  async deleteReview(id: string, adminUserId: string) {
    const review = await this.prisma.tourReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.tourReview.delete({ where: { id } });
    this.logger.log(`Review ${id} deleted by admin ${adminUserId}`);
    return { success: true };
  }

  async replyToReview(id: string, reply: string, adminUserId: string) {
    const review = await this.prisma.tourReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.tourReview.update({
      where: { id },
      data: { adminReply: reply },
    });

    this.logger.log(`Admin ${adminUserId} replied to review ${id}`);
    return updated;
  }
}
