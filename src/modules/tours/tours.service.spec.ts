import { Test, TestingModule } from '@nestjs/testing';
import { ToursService } from './tours.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('ToursService', () => {
  let service: ToursService;
  let prisma: PrismaService;
  let cacheManager: any;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToursService,
        {
          provide: PrismaService,
          useValue: {
            tour: {
              findFirst: jest.fn(),
              update: jest
                .fn()
                .mockResolvedValue({ id: '1', slug: 'test-tour' }),
              delete: jest
                .fn()
                .mockResolvedValue({ id: '1', slug: 'test-tour' }),
              count: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn().mockResolvedValue([0, []]),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: getToken('tours_viewed_total'),
          useValue: { inc: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ToursService>(ToursService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should update tour and invalidate cache', async () => {
      await service.update('test-tour', { isActive: false });
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { slug: 'test-tour' },
        data: { isActive: false },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('tour:test-tour:en');
      expect(cacheManager.del).toHaveBeenCalledWith('tour:test-tour:es');
    });
  });

  describe('remove', () => {
    it('should delete tour and invalidate cache', async () => {
      await service.remove('test-tour');
      expect(prisma.tour.delete).toHaveBeenCalledWith({
        where: { slug: 'test-tour' },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('tour:test-tour:en');
      expect(cacheManager.del).toHaveBeenCalledWith('tour:test-tour:es');
    });
  });
});
