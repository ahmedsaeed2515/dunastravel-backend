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
      expect(res.totalAmountUsd).toBe('250.00');
      expect(res.currency).toBe('USD');
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
  });
});
