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
    const tour = await db.tour.findUnique({
      where: { id: dto.tourId },
    });

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
        !['AVAILABLE', 'LIMITED'].includes(availability.status)
      ) {
        throw new UnprocessableEntityException(
          'Selected availability is not available',
        );
      }
      if (availability.tourId !== dto.tourId) {
        throw new UnprocessableEntityException(
          'Availability slot does not belong to the requested tour',
        );
      }

      if (dto.date) {
        const availDateStr = new Date(availability.date)
          .toISOString()
          .split('T')[0];
        const reqDateStr = new Date(dto.date).toISOString().split('T')[0];
        if (availDateStr !== reqDateStr) {
          throw new UnprocessableEntityException(
            'Selected availability slot date does not match requested pricing date',
          );
        }
      }

      if (!options?.skipCapacityCheck) {
        const totalPassengers = dto.adults + (dto.children || 0);
        if (availability.remainingSeats < totalPassengers) {
          throw new UnprocessableEntityException(
            'Selected availability has insufficient seats',
          );
        }
      }
    }

    const basePrice = new Prisma.Decimal(tour.basePriceUsd);
    const adultCount = dto.adults;
    const childCount = dto.children || 0;

    // Blueprint P1-007 rule: Child price is 50% of adult base price
    const adultBaseTotal = basePrice.mul(adultCount);
    const childBaseTotal = basePrice.mul(0.5).mul(childCount);
    const unadjustedSubtotal = adultBaseTotal.add(childBaseTotal);

    // Seasonal multiplier lookup
    const seasonPricing = tour.seasonPricingJsonb as SeasonPricingItem[] | null;
    let seasonalMultiplier = new Prisma.Decimal(1);
    if (seasonPricing && Array.isArray(seasonPricing) && dto.date) {
      const targetDate = new Date(dto.date);
      for (const season of seasonPricing) {
        if (
          new Date(season.startDate) <= targetDate &&
          new Date(season.endDate) >= targetDate
        ) {
          seasonalMultiplier = new Prisma.Decimal(season.multiplier || 1);
          break;
        }
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
        promoValid = true;
        promoMessage = messages.valid;
        discountAmount = adjustedSubtotal.mul(promo.discountPercent).div(100);
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

    const response: CalculatedPriceResponse = {
      basePriceUsd: basePrice.toFixed(2),
      adultTotalUsd: adultTotal.toFixed(2),
      childTotalUsd: childTotal.toFixed(2),
      seasonalAdjustmentUsd: seasonalAdjustment.toFixed(2),
      subtotalUsd: adjustedSubtotal.toFixed(2),
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
