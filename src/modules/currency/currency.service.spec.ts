import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('CurrencyService - handleDailyRateSync', () => {
  let service: CurrencyService;
  let prismaMock: any;
  let cacheMock: any;

  beforeEach(async () => {
    prismaMock = {
      currencyRate: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'EUR',
            rateToBase: '0.92',
            lastUpdated: new Date(),
            provider: 'TEST',
          },
        ]),
      },
    };

    cacheMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CACHE_MANAGER, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
  });

  it('should invalidate cache and fetch rates during daily sync', async () => {
    await service.handleDailyRateSync();

    expect(cacheMock.del).toHaveBeenCalledWith('global_exchange_rates_v2');
    expect(prismaMock.currencyRate.findMany).toHaveBeenCalled();
  });

  it('should catch errors gracefully without throwing exception during sync failure', async () => {
    cacheMock.del.mockRejectedValue(new Error('Cache connection error'));

    await expect(service.handleDailyRateSync()).resolves.not.toThrow();
  });
});
