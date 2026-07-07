import { Test, TestingModule } from '@nestjs/testing';
import { ToursService } from './tours.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getToken } from '@willsoto/nestjs-prometheus';

describe('ToursService', () => {
  let service: ToursService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToursService,
        {
          provide: PrismaService,
          useValue: {
            tour: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn((arg: any) => {
              if (Array.isArray(arg)) {
                return Promise.all(arg);
              }
              return arg({});
            }),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should apply active filter when resolving tours', async () => {
      jest.spyOn(prisma.tour, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.tour, 'findMany').mockResolvedValue([{ id: 'tour-1', images: [], basePriceUsd: { toString: () => '100' } }] as any);

      const result = await service.findAll({ isActive: true } as any);

      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findBySlug', () => {
    it('should resolve tour by slug', async () => {
      jest.spyOn(prisma.tour, 'findFirst').mockResolvedValue({ id: 'tour-2', slug: 'my-tour', itineraries: [], images: [], titleJsonb: { en: 'test' }, basePriceUsd: { toString: () => '150' } } as any);

      const result = await service.findBySlug('my-tour', 'en');

      expect(result?.slug).toBe('my-tour');
      expect(prisma.tour.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'my-tour', isActive: true },
        }),
      );
    });
  });
});
