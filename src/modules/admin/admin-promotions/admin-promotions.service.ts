import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminPromotionsService {
  private readonly logger = new Logger(AdminPromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listPromotions() {
    return this.prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPromotion(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }

  async createPromotion(dto: any, adminUserId: string) {
    const existing = await this.prisma.promotion.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Promotion code already exists');
    }

    const promo = await this.prisma.promotion.create({
      data: {
        code: dto.code,
        discountPercent: dto.discountPercent,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        maxUses: dto.maxUses,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    this.logger.log(`Promotion ${promo.code} created by admin ${adminUserId}`);
    return promo;
  }

  async updatePromotion(id: string, dto: any, adminUserId: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');

    if (dto.code && dto.code !== promo.code) {
      const existing = await this.prisma.promotion.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('Promotion code already exists');
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.discountPercent !== undefined && {
          discountPercent: dto.discountPercent,
        }),
        ...(dto.validFrom && { validFrom: new Date(dto.validFrom) }),
        ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
        ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(
      `Promotion ${updated.code} updated by admin ${adminUserId}`,
    );
    return updated;
  }

  async deletePromotion(id: string, adminUserId: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');

    await this.prisma.promotion.delete({ where: { id } });
    this.logger.log(`Promotion ${promo.code} deleted by admin ${adminUserId}`);
    return { success: true };
  }
}
