import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('PricingService Unit Tests', () => {
  let service: PricingService;
  let prismaMock: {
    tour: { findUnique: jest.Mock };
    tourAvailability: { findUnique: jest.Mock };
    promotion: { findFirst: jest.Mock };
  };

  const mockTour = {
    id: 'tour-100',
    slug: 'nile-cruise',
    basePriceUsd: new Prisma.Decimal(100),
    status: 'PUBLISHED',
    isActive: true,
    deletedAt: null,
    currency: 'USD',
    seasonPricingJsonb: null,
  };

  beforeEach(async () => {
    prismaMock = {
      tour: { findUnique: jest.fn().mockResolvedValue(mockTour) },
      tourAvailability: { findUnique: jest.fn() },
      promotion: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe('calculatePrice', () => {
    it('calculates 2 adults + 1 child with 50% child base price rule (200 + 50 = 250.00)', async () => {
      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-06-15',
        adults: 2,
        children: 1,
      });

      expect(res.basePriceUsd).toBe('100.00');
      expect(res.adultTotalUsd).toBe('200.00');
      expect(res.childTotalUsd).toBe('50.00');
      expect(res.seasonalAdjustmentUsd).toBe('0.00');
      expect(res.discountAmountUsd).toBe('0.00');
      expect(res.subtotalUsd).toBe('250.00');
      expect(res.taxAmountUsd).toBe('0.00');
      expect(res.totalAmountUsd).toBe('250.00');
      expect(res.currency).toBe('USD');
    });

    it('keeps a complimentary tour total at zero for adults and children', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({
        ...mockTour,
        country: 'Egypt',
        basePriceUsd: new Prisma.Decimal(0),
      });

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-06-15',
        adults: 2,
        children: 1,
      });

      expect(res.basePriceUsd).toBe('0.00');
      expect(res.adultTotalUsd).toBe('0.00');
      expect(res.childTotalUsd).toBe('0.00');
      expect(res.totalAmountUsd).toBe('0.00');
    });

    it('handles invalid promo code gracefully in preview mode without throwing (promoValid: false)', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(null);

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-06-15',
        adults: 1,
        promoCode: 'INVALID-PROMO',
        language: 'en',
      });

      expect(res.promoValid).toBe(false);
      expect(res.promoMessage).toBe('Invalid or expired promo code');
      expect(res.discountAmountUsd).toBe('0.00');
      expect(res.totalAmountUsd).toBe('100.00');
    });

    it('returns localized promo message when requested', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue(null);

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-06-15',
        adults: 1,
        promoCode: 'INVALID-PROMO',
        language: 'ar',
      });

      expect(res.promoValid).toBe(false);
      expect(res.promoMessage).toBe('كود الخصم غير صالحة أو منتهي الصلاحية');
    });

    it('applies valid promo code correctly in calculation mode', async () => {
      prismaMock.promotion.findFirst.mockResolvedValue({
        id: 'promo-1',
        code: 'SUMMER20',
        discountPercent: new Prisma.Decimal(20),
        isActive: true,
        currentUses: 0,
        maxUses: 100,
      });

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-06-15',
        adults: 2,
        promoCode: 'SUMMER20',
      });

      expect(res.promoValid).toBe(true);
      expect(res.discountAmountUsd).toBe('40.00');
      expect(res.totalAmountUsd).toBe('160.00');
    });

    it('throws UnprocessableEntityException when tour is not published', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({
        ...mockTour,
        status: 'DRAFT',
      });

      await expect(
        service.calculatePrice({
          tourId: 'tour-100',
          date: '2027-06-15',
          adults: 1,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('applies global Season multiplier fallback and accommodation supplement when present', async () => {
      (prismaMock as any).season = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'season-1',
          slug: 'peak-winter',
          nameJsonb: { en: 'Peak Winter' },
          defaultMultiplier: new Prisma.Decimal(1.5),
        }),
      };
      (prismaMock as any).tripAccommodation = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'acc-1',
          tourId: 'tour-100',
          priceSupplementUsd: new Prisma.Decimal(40),
        }),
      };

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2027-01-15',
        adults: 2,
        children: 0,
        accommodationId: 'acc-1',
      });

      // Base: 2 * 100 = 200; Season 1.5x = 300; Supplement: 2 * 40 = 80 -> Total 380.00
      expect(res.adultTotalUsd).toBe('300.00');
      expect(res.seasonalAdjustmentUsd).toBe('100.00');
      expect(res.accommodationSupplementUsd).toBe('80.00');
      expect(res.seasonName).toBe('Peak Winter');
      expect(res.totalAmountUsd).toBe('380.00');
    });

    it('supports Dashboard { rules: [...] } seasonPricingJsonb with priceUsd override and supplementUsd (BUG-01)', async () => {
      prismaMock.tour.findUnique.mockResolvedValue({
        ...mockTour,
        basePriceUsd: new Prisma.Decimal(100),
        seasonPricingJsonb: {
          rules: [
            {
              seasonCode: 'NEW_YEAR',
              seasonName: { en: 'New Year Gala', ar: 'رأس السنة' },
              startDate: '2026-12-20',
              endDate: '2027-01-05',
              priceUsd: 180,
              supplementUsd: 20,
            },
          ],
        },
      });

      const res = await service.calculatePrice({
        tourId: 'tour-100',
        date: '2026-12-25',
        adults: 2,
        children: 1,
        language: 'ar',
      });

      // Effective adult price = 180 + 20 = 200; 2 adults = 400; 1 child (50%) = 100 -> Total 500.00
      // Base without season = 2*100 + 1*50 = 250 -> seasonalAdjustmentUsd = 250.00
      expect(res.seasonName).toBe('رأس السنة');
      expect(res.adultTotalUsd).toBe('400.00');
      expect(res.childTotalUsd).toBe('100.00');
      expect(res.seasonalAdjustmentUsd).toBe('250.00');
      expect(res.totalAmountUsd).toBe('500.00');
    });
  });
});
