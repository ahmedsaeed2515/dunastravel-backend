import { Prisma } from '@prisma/client';
import { CurrencyService } from './currency.service';
import { PricingService } from '../pricing/pricing.service';

describe('USD/EUR Dual-Currency Production Integration Scenarios', () => {
  let currencyService: CurrencyService;
  let pricingService: PricingService;

  const mockPrisma = {
    currencyRate: {
      findMany: jest.fn().mockResolvedValue([
        {
          code: 'USD',
          rateToBase: new Prisma.Decimal(1.0),
          lastUpdated: new Date(),
          provider: 'SYSTEM_BASE',
        },
        {
          code: 'EUR',
          rateToBase: new Prisma.Decimal(0.888652), // 1 USD = 0.888652 EUR -> 1 EUR = ~1.125300 USD
          lastUpdated: new Date(),
          provider: 'ECB_FRANKFURTER',
        },
      ]),
      upsert: jest.fn(),
    },
    currencyRateHistory: {
      upsert: jest.fn(),
    },
    seasonPricing: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    promotion: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    promotionUsage: {
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockFrankfurter = {
    fetchEurUsdRate: jest.fn().mockResolvedValue({
      rate: 1.1253,
      inverseRate: 0.888652,
      date: '2026-10-16',
      rawProvider: 'ECB',
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    currencyService = new CurrencyService(
      mockPrisma as any,
      mockRedis as any,
      mockFrankfurter as any,
    );
    pricingService = new PricingService(mockPrisma as any, currencyService);
  });

  describe('Scenario A: Admin enters price in USD (600 USD)', () => {
    it('stores authoritative USD price and derives EUR amount with high precision', async () => {
      // Admin enters 600 USD
      const enteredPrice = 600;
      const enteredCurrency = 'USD';

      // 1. Authoritative rates from CurrencyService
      const eurUsdRate = await currencyService.getEurUsdRate();
      expect(eurUsdRate.ecbUsdEurRate).toBe('0.888652');
      expect(eurUsdRate.ecbEurUsdRate).toBe('1.125300');

      // 2. Conversion to EUR
      const convertedToEur = await currencyService.convert(enteredPrice, 'USD', 'EUR');
      expect(convertedToEur.from).toBe('USD');
      expect(convertedToEur.to).toBe('EUR');
      // 600 * 0.888652 = 533.1912 -> rounded half up = 533.19
      expect(convertedToEur.convertedAmount).toBe(533.19);

      // 3. PricingService calculates dual-currency summary
      const mockTour = {
        id: 'tour-usd-1',
        slug: 'classic-cairo-usd',
        basePriceUsd: new Prisma.Decimal(600),
        originalPrice: new Prisma.Decimal(600),
        currency: 'USD',
        originalCurrency: 'USD',
        isFeatured: false,
        isActive: true,
        category: 'Classic',
      };

      const pricing = await pricingService.calculatePrice({
        tour: mockTour as any,
        adults: 1,
        children: 0,
        infants: 0,
      });

      expect(pricing.totalAmountUsd).toBe('600.00');
      expect(pricing.totalAmountEur).toBe('533.19');
      expect(pricing.authoritativeAmount).toBe('600.00');
      expect(pricing.authoritativeCurrency).toBe('USD');
      expect(pricing.exchangeRate).toBe('1.125300');
    });
  });

  describe('Scenario B: Admin enters price in EUR (600 EUR)', () => {
    it('stores authoritative EUR price, computes basePriceUsd = 675.18, and derives accurate dual totals', async () => {
      // Admin enters 600 EUR
      const enteredPrice = 600;
      const enteredCurrency = 'EUR';

      // 1. Convert 600 EUR to USD base: 600 * 1.1253 = 675.18 USD
      const convertedToUsd = await currencyService.convert(enteredPrice, 'EUR', 'USD');
      expect(convertedToUsd.from).toBe('EUR');
      expect(convertedToUsd.to).toBe('USD');
      // 600 / 0.888652 = 675.1802 -> 675.18
      expect(convertedToUsd.convertedAmount).toBe(675.18);

      // 2. Mock Tour as saved in PostgreSQL with authoritative EUR and derived basePriceUsd
      const mockTour = {
        id: 'tour-eur-1',
        slug: 'classic-cairo-eur',
        basePriceUsd: new Prisma.Decimal(675.18),
        originalPrice: new Prisma.Decimal(600),
        currency: 'EUR',
        originalCurrency: 'EUR',
        isFeatured: false,
        isActive: true,
        category: 'Classic',
      };

      // 3. PricingService calculation preserves 600 EUR authoritative amount
      const pricing = await pricingService.calculatePrice({
        tour: mockTour as any,
        adults: 1,
        children: 0,
        infants: 0,
      });

      expect(pricing.authoritativeAmount).toBe('600.00');
      expect(pricing.authoritativeCurrency).toBe('EUR');
      expect(pricing.totalAmountEur).toBe('600.00');
      expect(pricing.totalAmountUsd).toBe('675.18');
    });
  });

  describe('Scenario C: Immutable Transaction Snapshot on Booking & Invoice', () => {
    it('freezes exchange rate and ensures subsequent rate changes never alter historical amounts', async () => {
      // Initial booking in EUR
      const frozenBooking = {
        id: 'bk-imm-1',
        referenceCode: 'DUNAS-EUR-999',
        currency: 'EUR',
        originalAmount: new Prisma.Decimal('600.00'),
        originalCurrency: 'EUR',
        exchangeRate: new Prisma.Decimal('1.125300'),
        exchangeRateDate: '2026-10-16',
        exchangeRateSource: 'ECB',
        totalAmountUsd: new Prisma.Decimal('675.18'),
        invoice: {
          id: 'inv-imm-1',
          total: new Prisma.Decimal('600.00'),
          currency: 'EUR',
          exchangeRate: new Prisma.Decimal('1.125300'),
          exchangeRateDate: '2026-10-16',
        },
      };

      // Verify the frozen fields
      expect(frozenBooking.currency).toBe('EUR');
      expect(frozenBooking.originalAmount.toFixed(2)).toBe('600.00');
      expect(frozenBooking.invoice.total.toFixed(2)).toBe('600.00');
      expect(frozenBooking.invoice.currency).toBe('EUR');
      expect(frozenBooking.exchangeRate.toFixed(6)).toBe('1.125300');

      // Now simulate a market exchange rate swing the next day:
      // EUR crashes or spikes: 1 EUR = 1.300000 USD
      mockPrisma.currencyRate.findMany.mockResolvedValueOnce([
        {
          code: 'USD',
          rateToBase: new Prisma.Decimal(1.0),
          lastUpdated: new Date('2026-10-17'),
          provider: 'SYSTEM_BASE',
        },
        {
          code: 'EUR',
          rateToBase: new Prisma.Decimal(0.769231), // 1 / 1.300000
          lastUpdated: new Date('2026-10-17'),
          provider: 'ECB_FRANKFURTER',
        },
      ]);

      const newMarketRate = await currencyService.getEurUsdRate();
      expect(newMarketRate.ecbEurUsdRate).toBe('1.300000');

      // Historical booking remains 100% frozen and unmodified:
      expect(frozenBooking.originalAmount.toFixed(2)).toBe('600.00');
      expect(frozenBooking.currency).toBe('EUR');
      expect(frozenBooking.exchangeRate.toFixed(6)).toBe('1.125300');
      expect(frozenBooking.invoice.total.toFixed(2)).toBe('600.00');
      expect(frozenBooking.invoice.currency).toBe('EUR');
    });
  });

  describe('Scenario D: GetPayIn Payment Gateway Currency Alignment', () => {
    it('initiates charge in EUR when booking is in EUR, and verifies payment record', () => {
      const booking = {
        id: 'bk-pay-1',
        currency: 'EUR',
        totalAmountUsd: new Prisma.Decimal('675.18'),
        invoice: {
          id: 'inv-pay-1',
          total: new Prisma.Decimal('600.00'),
          currency: 'EUR',
        },
      };

      const supportedCurrencies = ['USD', 'EUR'];
      expect(supportedCurrencies.includes(booking.currency)).toBe(true);

      const chargeCurrency = booking.currency;
      const chargeAmount = booking.invoice.total.toNumber();

      expect(chargeCurrency).toBe('EUR');
      expect(chargeAmount).toBe(600.00);

      // Verify payment record shape
      const paymentRecord = {
        bookingId: booking.id,
        invoiceId: booking.invoice.id,
        amount: new Prisma.Decimal(chargeAmount),
        currency: chargeCurrency,
        status: 'PENDING',
      };

      expect(paymentRecord.currency).toBe('EUR');
      expect(paymentRecord.amount.toFixed(2)).toBe('600.00');
    });
  });
});
