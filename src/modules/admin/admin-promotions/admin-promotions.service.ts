import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

  async listPromotions(
    query: { page?: number; limit?: number; search?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.PromotionWhereInput = query.search?.trim()
      ? { code: { contains: query.search.trim(), mode: 'insensitive' } }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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

    if (
      !Number.isFinite(dto.discountPercent) ||
      dto.discountPercent <= 0 ||
      dto.discountPercent > 90
    ) {
      throw new BadRequestException(
        'Discount percentage must be between 0 and 90',
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

    const promo = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          code,
          discountPercent: new Prisma.Decimal(dto.discountPercent),
          validFrom,
          validUntil,
          maxUses: dto.maxUses,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'PROMOTION_CREATED',
          entityType: 'Promotion',
          entityId: created.id,
          metadata: { code: created.code },
        },
      });
      return created;
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
      (!Number.isFinite(dto.discountPercent) ||
        dto.discountPercent <= 0 ||
        dto.discountPercent > 90)
    ) {
      throw new BadRequestException(
        'Discount percentage must be between 0 and 90',
      );
    }

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : promo.validFrom;
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : promo.validUntil;
    if (validFrom >= validUntil) {
      throw new BadRequestException('validFrom must be before validUntil');
    }
    if (dto.maxUses !== undefined && dto.maxUses < promo.currentUses) {
      throw new BadRequestException(
        'Maximum uses cannot be lower than current redemptions',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.promotion.update({
        where: { id },
        data: {
          code,
          ...(dto.discountPercent !== undefined && {
            discountPercent: new Prisma.Decimal(dto.discountPercent),
          }),
          ...(dto.validFrom && { validFrom }),
          ...(dto.validUntil && { validUntil }),
          ...(dto.maxUses !== undefined && { maxUses: dto.maxUses }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'PROMOTION_UPDATED',
          entityType: 'Promotion',
          entityId: id,
          metadata: { changedFields: Object.keys(dto) },
        },
      });
      return result;
    });

    this.logger.log(
      `Promotion ${updated.code} updated by admin ${adminUserId}`,
    );
    return updated;
  }

  async deletePromotion(id: string, adminUserId: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'PROMOTION_DEACTIVATED',
          entityType: 'Promotion',
          entityId: id,
          metadata: { code: promo.code },
        },
      });
    });
    this.logger.log(
      `Promotion ${promo.code} deactivated by super admin ${adminUserId}`,
    );
    return { success: true, deactivated: true };
  }
}
