import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validatePromoCode(rawCode: string) {
    if (!rawCode || rawCode.trim().length === 0) {
      throw new BadRequestException('Promotion code is required');
    }

    const code = rawCode.trim().toUpperCase();
    const promo = await this.prisma.promotion.findUnique({
      where: { code },
    });

    if (!promo || !promo.isActive) {
      throw new BadRequestException('Invalid or inactive promotion code');
    }

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      throw new BadRequestException('Promotion code is not yet valid');
    }
    if (promo.validUntil && now > promo.validUntil) {
      throw new BadRequestException('Promotion code has expired');
    }
    if (promo.maxUses !== null && promo.currentUses >= promo.maxUses) {
      throw new BadRequestException(
        'Promotion code has reached its usage limit',
      );
    }

    return {
      id: promo.id,
      code: promo.code,
      discountPercent: promo.discountPercent,
      validFrom: promo.validFrom,
      validUntil: promo.validUntil,
    };
  }

  async acquireQuota(
    tx: Prisma.TransactionClient | PrismaService,
    promotionId: string,
  ): Promise<void> {
    const count = await tx.$executeRaw`
      UPDATE promotions
      SET current_uses = current_uses + 1,
          updated_at = NOW()
      WHERE id = ${promotionId}
        AND is_active = true
        AND current_uses < max_uses
    `;

    const rowsAffected = typeof count === 'number' ? count : Number(count);
    if (rowsAffected === 0) {
      throw new UnprocessableEntityException(
        'Promotion usage limit reached or promotion is inactive',
      );
    }
  }

  async releaseQuota(
    tx: Prisma.TransactionClient | PrismaService,
    promotionId: string,
  ): Promise<void> {
    if (!promotionId) return;
    await tx.$executeRaw`
      UPDATE promotions
      SET current_uses = GREATEST(0, current_uses - 1),
          updated_at = NOW()
      WHERE id = ${promotionId}
    `;
  }
}
