import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validatePromoCode(code: string) {
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
    };
  }
}
