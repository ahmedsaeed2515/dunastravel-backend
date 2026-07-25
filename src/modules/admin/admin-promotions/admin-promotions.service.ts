import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AdminCreatePromotionDto {
  code: string;
  discountPercent: number;
  validFrom: string | Date;
  validUntil: string | Date;
  maxUses: number;
  isActive?: boolean;
}

export interface AdminUpdatePromotionDto {
  code?: string;
  discountPercent?: number;
  validFrom?: string | Date;
  validUntil?: string | Date;
  maxUses?: number;
  isActive?: boolean;
}

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

  async createPromotion(dto: AdminCreatePromotionDto, adminUserId: string) {
    if (!dto.code || dto.code.trim().length === 0) {
      throw new BadRequestException('Promotion code is required');
    }
    const code = dto.code.trim().toUpperCase();

    if (dto.discountPercent <= 0 || dto.discountPercent > 100) {
      throw new BadRequestException(
        'Discount percentage must be greater than 0 and less than or equal to 100',
      );
    }

    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);
    if (
      isNaN(validFrom.getTime()) ||
      isNaN(validUntil.getTime()) ||
      validFrom >= validUntil
    ) {
      throw new BadRequestException(
        'validFrom must be a valid date before validUntil',
      );
    }

    const existing = await this.prisma.promotion.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException('Promotion code already exists');
    }

    const promo = await this.prisma.promotion.create({
      data: {
        code,
        discountPercent: dto.discountPercent,
        validFrom,
        validUntil,
        maxUses: dto.maxUses,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    this.logger.log(`Promotion ${promo.code} created by admin ${adminUserId}`);
    return promo;
  }

  async updatePromotion(
    id: string,
    dto: AdminUpdatePromotionDto,
    adminUserId: string,
  ) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');

    let code = promo.code;
    if (dto.code && dto.code.trim().length > 0) {
      code = dto.code.trim().toUpperCase();
      if (code !== promo.code) {
        const existing = await this.prisma.promotion.findUnique({
          where: { code },
        });
        if (existing) {
          throw new ConflictException('Promotion code already exists');
        }
      }
    }

    if (
      dto.discountPercent !== undefined &&
      (dto.discountPercent <= 0 || dto.discountPercent > 100)
    ) {
      throw new BadRequestException(
        'Discount percentage must be greater than 0 and less than or equal to 100',
      );
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : promo.validFrom;
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : promo.validUntil;
    if (validFrom >= validUntil) {
      throw new BadRequestException('validFrom must be before validUntil');
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        code,
        ...(dto.discountPercent !== undefined && {
          discountPercent: dto.discountPercent,
        }),
        ...(dto.validFrom && { validFrom }),
        ...(dto.validUntil && { validUntil }),
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
