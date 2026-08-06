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

    const now = new Date();
    if (
      !promo ||
      !promo.isActive ||
      now < promo.validFrom ||
      now > promo.validUntil ||
      promo.currentUses >= promo.maxUses
    ) {
      throw new BadRequestException('Invalid promotion code');
    }

    return {
      id: promo.id,
      code: promo.code,
      discountPercent: promo.discountPercent.toFixed(2),
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
        AND valid_from <= NOW()
        AND valid_until >= NOW()
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
