import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface CalculatePriceOptions {
  skipCapacityCheck?: boolean;
}

export interface PriceDiscountItem {
  name: string;
  amountUsd: string;
  code?: string;
}

export interface CalculatedPriceResponse {
  basePriceUsd: string;
  adultTotalUsd: string;
  childTotalUsd: string;
  seasonalAdjustmentUsd: string;
  subtotalUsd: string;
  discountAmountUsd: string;
  taxAmountUsd: string;
  totalAmountUsd: string;
  currency: string;
  promoValid: boolean;
  promoMessage: string | null;
  discounts?: PriceDiscountItem[];
}

export interface SeasonPricingItem {
  startDate: string;
  endDate: string;
  multiplier: number;
}

const PROMO_MESSAGES: Record<
  string,
  { invalid: string; limitReached: string; valid: string }
> = {
  en: {
    invalid: 'Invalid or expired promo code',
    limitReached: 'Promo code usage limit reached',
    valid: 'Promo code applied successfully',
  },
  ar: {
    invalid: 'كود الخصم غير صالحة أو منتهي الصلاحية',
    limitReached: 'تم الوصول إلى حد استخدام كود الخصم',
    valid: 'تم تطبيق كود الخصم بنجاح',
  },
  es: {
    invalid: 'Código de promoción no válido o expirado',
    limitReached: 'Se ha alcanzado el límite de uso del código de promoción',
    valid: 'Código de promoción aplicado con éxito',
  },
  pt: {
    invalid: 'Código de promoção inválido ou expirado',
    limitReached: 'Limite de uso do código de promoção atingido',
    valid: 'Código de promoção aplicado com sucesso',
  },
  it: {
    invalid: 'Codice promozionale non valido o scaduto',
    limitReached: 'Limite di utilizzo del codice promozionale raggiunto',
    valid: 'Codice promozionale applicato con sucesso',
  },
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async calculatePrice(
    dto: CalculatePriceDto,
    tx?: Prisma.TransactionClient | PrismaService,
    options?: CalculatePriceOptions,
  ): Promise<CalculatedPriceResponse> {
    const db = tx || this.prisma;
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        dto.tourId,
      );
    let tour = isUUID && typeof db.tour.findUnique === 'function'
      ? await db.tour.findUnique({ where: { id: dto.tourId } })
      : null;

    if (!tour && typeof db.tour.findUnique === 'function') {
      tour = await db.tour.findUnique({ where: { id: dto.tourId } });
    }

    if (!tour && !isUUID && typeof db.tour.findFirst === 'function') {
      tour = await db.tour.findFirst({ where: { slug: dto.tourId } });
    }

    if (
      !tour ||
      tour.status !== 'PUBLISHED' ||
      !tour.isActive ||
      tour.deletedAt !== null
    ) {
      throw new UnprocessableEntityException(
        'Tour is not available for booking',
      );
    }

    const availId = dto.availabilityId || dto.departureId;
    if (availId) {
      const availability = await db.tourAvailability.findUnique({
        where: { id: availId },
      });
      if (
        !availability ||
        availability.status === 'CLOSED'
      ) {
        throw new UnprocessableEntityException(
          'Selected departure date is closed for bookings',
        );
      }
      if (availability.tourId !== tour.id) {
        throw new UnprocessableEntityException(
          'Availability slot does not belong to the requested tour',
        );
      }

      if (dto.date) {
        const availDate = new Date(availability.date);
        const availDateStr = `${availDate.getUTCFullYear()}-${String(availDate.getUTCMonth() + 1).padStart(2, '0')}-${String(availDate.getUTCDate()).padStart(2, '0')}`;
        const reqDate = new Date(dto.date);
        const reqDateStr = `${reqDate.getUTCFullYear()}-${String(reqDate.getUTCMonth() + 1).padStart(2, '0')}-${String(reqDate.getUTCDate()).padStart(2, '0')}`;
        if (availDateStr !== reqDateStr && dto.date !== availDateStr) {
          throw new UnprocessableEntityException(
            `Selected availability slot date (${availDateStr}) does not match requested pricing date (${dto.date})`,
          );
        }
      }

      // In Dunas Travel, tours have no fixed capacity cap by default.
      // Availability slots track volume for informational purposes; pricing does not block on remaining seats.
    }

    const basePrice = new Prisma.Decimal(tour.basePriceUsd);
    const adultCount = dto.adults;
    const childCount = dto.children || 0;

    // Blueprint P1-007 rule: Child price is 50% of adult base price
    const adultBaseTotal = basePrice.mul(adultCount);
    const childBaseTotal = basePrice.mul(0.5).mul(childCount);
    const unadjustedSubtotal = adultBaseTotal.add(childBaseTotal);

    // Seasonal multiplier lookup
    const seasonPricing = tour.seasonPricingJsonb as any;
    let seasonalMultiplier = new Prisma.Decimal(1);
    const rulesArray: SeasonPricingItem[] | null = Array.isArray(seasonPricing)
      ? seasonPricing
      : (Array.isArray(seasonPricing?.rules)
        ? seasonPricing.rules
        : (Array.isArray(seasonPricing?.seasonalMultipliers)
          ? seasonPricing.seasonalMultipliers
          : null));

    if (rulesArray && dto.date) {
      const targetDate = new Date(`${dto.date}T00:00:00.000Z`);
      const matchingRules: Prisma.Decimal[] = [];
      for (const season of rulesArray) {
        if (!season?.startDate || !season?.endDate || season?.multiplier === undefined) continue;
        const start = new Date(`${season.startDate}T00:00:00.000Z`);
        const end = new Date(`${season.endDate}T00:00:00.000Z`);
        let multiplier: Prisma.Decimal;
        try {
          multiplier = new Prisma.Decimal(season.multiplier);
        } catch {
          throw new UnprocessableEntityException(
            'Tour seasonal pricing configuration is invalid',
          );
        }
        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime()) ||
          start > end ||
          !multiplier.isFinite() ||
          multiplier.lt(0.5) ||
          multiplier.gt(5)
        ) {
          throw new UnprocessableEntityException(
            'Tour seasonal pricing configuration is invalid',
          );
        }
        if (start <= targetDate && end >= targetDate) {
          matchingRules.push(multiplier);
        }
      }
      if (matchingRules.length > 1) {
        throw new UnprocessableEntityException(
          'Tour seasonal pricing rules overlap',
        );
      }
      if (matchingRules.length === 1) {
        seasonalMultiplier = matchingRules[0];
      }
    }

    const adultTotal = adultBaseTotal.mul(seasonalMultiplier);
    const childTotal = childBaseTotal.mul(seasonalMultiplier);
    const adjustedSubtotal = adultTotal.add(childTotal);
    const seasonalAdjustment = adjustedSubtotal.sub(unadjustedSubtotal);

    const lang = (dto.language || 'en').toLowerCase();
    const messages = PROMO_MESSAGES[lang] || PROMO_MESSAGES.en;

    let promoValid = false;
    let promoMessage: string | null = null;
    let discountAmount = new Prisma.Decimal(0);
    const discounts: PriceDiscountItem[] = [];

    if (dto.promoCode && dto.promoCode.trim().length > 0) {
      const promoUpper = dto.promoCode.trim().toUpperCase();
      const now = new Date();

      const promo = await db.promotion.findFirst({
        where: {
          code: promoUpper,
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now },
        },
      });

      if (!promo) {
        promoValid = false;
        promoMessage = messages.invalid;
      } else if (promo.currentUses >= promo.maxUses) {
        promoValid = false;
        promoMessage = messages.limitReached;
      } else {
        const promoPercent = new Prisma.Decimal(promo.discountPercent);
        if (promoPercent.lte(0) || promoPercent.gt(90)) {
          throw new UnprocessableEntityException(
            'Promotion configuration is invalid',
          );
        }
        promoValid = true;
        promoMessage = messages.valid;
        discountAmount = adjustedSubtotal.mul(promoPercent).div(100);
        discounts.push({
          name: `Promo Code: ${promo.code}`,
          amountUsd: discountAmount.toFixed(2),
          code: promo.code,
        });
      }
    }

    const finalTotal = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      adjustedSubtotal.sub(discountAmount),
    );
    if (
      !finalTotal.isFinite() ||
      finalTotal.lt(0) ||
      finalTotal.gt(99_999_999.99)
    ) {
      throw new UnprocessableEntityException(
        'Calculated price is outside the allowed range',
      );
    }

    // Prices are final and all-inclusive; no separate tax surcharge or deduction.
    const response: CalculatedPriceResponse = {
      basePriceUsd: basePrice.toFixed(2),
      adultTotalUsd: adultTotal.toFixed(2),
      childTotalUsd: childTotal.toFixed(2),
      seasonalAdjustmentUsd: seasonalAdjustment.toFixed(2),
      subtotalUsd: finalTotal.toFixed(2),
      discountAmountUsd: discountAmount.toFixed(2),
      taxAmountUsd: '0.00',
      totalAmountUsd: finalTotal.toFixed(2),
      currency: tour.currency || 'USD',
      promoValid,
      promoMessage,
      discounts,
    };

    try {
      this.eventEmitter.emit('price_calculated', {
        tourId: dto.tourId,
        totalAmountUsd: response.totalAmountUsd,
        promoCode: dto.promoCode || null,
      });
    } catch {
      // Non-blocking analytics emission
    }

    return response;
  }
}
