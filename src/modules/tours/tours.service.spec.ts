import { Test, TestingModule } from '@nestjs/testing';
import { ToursService } from './tours.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Prisma } from '@prisma/client';

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
            $transaction: jest.fn(
              (
                arg:
                  Array<Promise<unknown>> | ((tx: unknown) => Promise<unknown>),
              ) => {
                if (Array.isArray(arg)) {
                  return Promise.all(arg);
                }
                return arg({});
              },
            ),
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
      const countSpy = jest.spyOn(prisma.tour, 'count').mockResolvedValue(1);
      const findManySpy = jest
        .spyOn(prisma.tour, 'findMany')
        .mockResolvedValue([
          {
            id: 'tour-1',
            slug: 'tour-1',
            titleJsonb: { en: 'Tour 1' },
            category: 'CULTURE',
            durationJsonb: { en: '3 Days' },
            images: [],
            basePriceUsd: new Prisma.Decimal('100.00'),
          },
        ] as any);

      const result = await service.findAll({ lang: 'en', page: 1, limit: 10 });

      expect(countSpy).toHaveBeenCalled();
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            status: 'PUBLISHED',
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findBySlug', () => {
    it('should resolve tour by slug', async () => {
      const findFirstSpy = jest
        .spyOn(prisma.tour, 'findFirst')
        .mockResolvedValue({
          id: 'tour-2',
          slug: 'my-tour',
          itineraries: [],
          images: [],
          titleJsonb: { en: 'test' },
          basePriceUsd: new Prisma.Decimal('150.00'),
        } as any);

      const result = await service.findBySlug('my-tour', 'en');

      expect(result?.slug).toBe('my-tour');
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'my-tour', isActive: true, status: 'PUBLISHED' },
        }),
      );
    });
  });
});
