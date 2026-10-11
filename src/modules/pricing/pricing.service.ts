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
  accommodationSupplementUsd?: string;
  seasonName?: string | null;
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
  seasonId?: string;
  seasonCode?: string;
  seasonName?: string | Record<string, string>;
  startDate: string;
  endDate: string;
  multiplier?: number;
  priceUsd?: number;
  supplementUsd?: number;
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
    invalid: 'Código de promoción inválido ou expirado',
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
    const langKey = (dto.language || 'en').toLowerCase();

    // Blueprint P1-007 rule: Child price is 50% of adult base price
    const adultBaseTotal = basePrice.mul(adultCount);
    const childBaseTotal = basePrice.mul(0.5).mul(childCount);
    const unadjustedSubtotal = adultBaseTotal.add(childBaseTotal);

    // Seasonal multiplier / price override / supplement lookup
    const seasonPricing = tour.seasonPricingJsonb as any;
    let seasonalMultiplier = new Prisma.Decimal(1);
    let seasonalPriceOverride: Prisma.Decimal | null = null;
    let seasonalSupplementPerAdult = new Prisma.Decimal(0);
    let matchedSeasonName: string | null = null;
    const rulesArray: SeasonPricingItem[] | null = Array.isArray(seasonPricing)
      ? seasonPricing
      : (Array.isArray(seasonPricing?.rules)
        ? seasonPricing.rules
        : (Array.isArray(seasonPricing?.seasonalMultipliers)
          ? seasonPricing.seasonalMultipliers
          : null));

    if (rulesArray && rulesArray.length > 0 && dto.date) {
      const targetDate = new Date(`${dto.date}T00:00:00.000Z`);
      const matchingRules: Array<{
        multiplier: Prisma.Decimal;
        priceOverride: Prisma.Decimal | null;
        supplement: Prisma.Decimal;
        name: string | null;
      }> = [];
      for (const season of rulesArray) {
        if (!season?.startDate || !season?.endDate) continue;
        const hasMult = season.multiplier !== undefined && season.multiplier !== null;
        const hasPrice = season.priceUsd !== undefined && season.priceUsd !== null && Number(season.priceUsd) > 0;
        const hasSupp = season.supplementUsd !== undefined && season.supplementUsd !== null;
        if (!hasMult && !hasPrice && !hasSupp) continue;

        const start = new Date(`${season.startDate}T00:00:00.000Z`);
        const end = new Date(`${season.endDate}T00:00:00.000Z`);
        let multiplier = new Prisma.Decimal(1);
        let priceOverride: Prisma.Decimal | null = null;
        let supplement = new Prisma.Decimal(0);
        try {
          if (hasMult) {
            multiplier = new Prisma.Decimal(season.multiplier!);
          }
          if (hasPrice) {
            priceOverride = new Prisma.Decimal(season.priceUsd!);
          }
          if (hasSupp) {
            supplement = new Prisma.Decimal(season.supplementUsd!);
          }
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
          (hasMult && (multiplier.lt(0.5) || multiplier.gt(5))) ||
          (priceOverride !== null && (!priceOverride.isFinite() || priceOverride.lt(0))) ||
          !supplement.isFinite() ||
          supplement.lt(0)
        ) {
          throw new UnprocessableEntityException(
            'Tour seasonal pricing configuration is invalid',
          );
        }
        if (start <= targetDate && end >= targetDate) {
          const rawName = season.seasonName ?? (season as any).label ?? season.seasonCode ?? null;
          const resolvedName =
            rawName && typeof rawName === 'object'
              ? (rawName[langKey] || rawName.en || rawName.ar || Object.values(rawName)[0] || null)
              : (typeof rawName === 'string' ? rawName : null);
          matchingRules.push({
            multiplier,
            priceOverride,
            supplement,
            name: resolvedName,
          });
        }
      }
      if (matchingRules.length > 1) {
        throw new UnprocessableEntityException(
          'Tour seasonal pricing rules overlap',
        );
      }
      if (matchingRules.length === 1) {
        seasonalMultiplier = matchingRules[0].multiplier;
        seasonalPriceOverride = matchingRules[0].priceOverride;
        seasonalSupplementPerAdult = matchingRules[0].supplement;
        matchedSeasonName = matchingRules[0].name;
      }
    } else if (dto.date && typeof (db as any).season?.findFirst === 'function') {
      const targetDate = new Date(`${dto.date}T00:00:00.000Z`);
      const dbSeason = await (db as any).season.findFirst({
        where: {
          isActive: true,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
        orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
      });
      const rawMult = dbSeason?.multiplier ?? dbSeason?.defaultMultiplier;
      if (dbSeason && rawMult !== undefined) {
        const candidate = new Prisma.Decimal(rawMult);
        if (candidate.isFinite() && candidate.gte(0.5) && candidate.lte(5)) {
          seasonalMultiplier = candidate;
          const nameObj =
            dbSeason.nameJsonb && typeof dbSeason.nameJsonb === 'object'
              ? (dbSeason.nameJsonb as Record<string, string>)
              : {};
          matchedSeasonName =
            nameObj[langKey] || nameObj.en || dbSeason.code || dbSeason.slug || null;
        }
      }
    }

    const effectiveAdultUnit = (seasonalPriceOverride ?? basePrice)
      .mul(seasonalMultiplier)
      .add(seasonalSupplementPerAdult);
    const adultTotal = effectiveAdultUnit.mul(adultCount);
    const childTotal = effectiveAdultUnit.mul(0.5).mul(childCount);
    let adjustedSubtotal = adultTotal.add(childTotal);
    const seasonalAdjustment = adjustedSubtotal.sub(unadjustedSubtotal);

    // Optional TripAccommodation / Room supplement lookup
    let accommodationSupplement = new Prisma.Decimal(0);
    if (
      (dto.accommodationId || dto.roomId) &&
      typeof (db as any).tripAccommodation?.findFirst === 'function'
    ) {
      const accRecord = await (db as any).tripAccommodation.findFirst({
        where: {
          tourId: tour.id,
          ...(dto.accommodationId ? { id: dto.accommodationId } : { roomId: dto.roomId }),
        },
      });
      if (accRecord && accRecord.priceSupplementUsd) {
        const suppPerAdult = new Prisma.Decimal(accRecord.priceSupplementUsd);
        if (suppPerAdult.gt(0)) {
          accommodationSupplement = suppPerAdult
            .mul(adultCount)
            .add(suppPerAdult.mul(0.5).mul(childCount));
          adjustedSubtotal = adjustedSubtotal.add(accommodationSupplement);
        }
      }
    }

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
      ...(accommodationSupplement.gt(0)
        ? { accommodationSupplementUsd: accommodationSupplement.toFixed(2) }
        : {}),
      ...(matchedSeasonName ? { seasonName: matchedSeasonName } : {}),
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
