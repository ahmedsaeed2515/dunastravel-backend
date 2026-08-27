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
      expect(result.data).toHaveLength(1);
    });

    it('filters Dubai by its canonical destination relation, not its country label', async () => {
      jest.spyOn(prisma.tour, 'count').mockResolvedValue(0);
      const findManySpy = jest.spyOn(prisma.tour, 'findMany').mockResolvedValue([] as any);

      await service.findAll({ lang: 'en', destination: 'United Arab Emirates', page: 1, limit: 10 });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            landingPages: {
              some: {
                isVisible: true,
                landingPage: expect.objectContaining({ slug: 'dubai', type: 'DESTINATION' }),
              },
            },
          }),
        }),
      );
      expect(findManySpy.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          where: expect.not.objectContaining({ country: expect.anything() }),
        }),
      );
    });

    it('keeps country filtering separate from canonical destination filtering', async () => {
      jest.spyOn(prisma.tour, 'count').mockResolvedValue(0);
      const findManySpy = jest.spyOn(prisma.tour, 'findMany').mockResolvedValue([] as any);

      await service.findAll({ lang: 'en', country: 'United Arab Emirates', page: 1, limit: 10 });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: { equals: 'United Arab Emirates', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('should resolve tour by slug', async () => {
      const findFirstSpy = jest
        .spyOn(prisma.tour, 'findFirst')
        .mockResolvedValue({
          id: 'tour-2',
          slug: 'my-tour',
          currency: 'USD',
          itineraries: [],
          images: [],
          titleJsonb: { en: 'test' },
          basePriceUsd: new Prisma.Decimal('150.00'),
        } as any);

      const result = await service.findBySlug('my-tour', 'en');

      expect(result?.slug).toBe('my-tour');
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'my-tour',
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        }),
      );
    });

    it('keeps a draft preview out of the public cache and adds only visibility context', async () => {
      const findFirstSpy = jest
        .spyOn(prisma.tour, 'findFirst')
        .mockResolvedValue({
          id: 'tour-draft',
          slug: 'draft-tour',
          status: 'DRAFT',
          isActive: true,
          currency: 'USD',
          titleJsonb: { en: 'Draft Tour' },
          durationJsonb: { en: '2 days' },
          overviewJsonb: { en: 'Draft overview' },
          basePriceUsd: new Prisma.Decimal('250.00'),
          includedServicesJsonb: { en: ['Guide'] },
          excludedServicesJsonb: { en: ['Flights'] },
          tags: [],
          itineraries: [],
          images: [],
        } as any);

      const result = await service.findPreviewBySlug('draft-tour', 'en');

      expect(result).toMatchObject({
        slug: 'draft-tour',
        title: 'Draft Tour',
        currency: 'USD',
        preview: { status: 'DRAFT', isActive: true, isPublic: false },
      });
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'draft-tour', deletedAt: null } }),
      );
    });

    it('projects identical published presentation fields for public detail and admin preview', async () => {
      jest.spyOn(prisma.tour, 'findFirst').mockResolvedValue({
        id: 'tour-published',
        slug: 'published-tour',
        status: 'PUBLISHED',
        isActive: true,
        currency: 'USD',
        titleJsonb: { en: 'Published Tour' },
        durationJsonb: { en: '4 days' },
        overviewJsonb: { en: 'Published overview' },
        cancellationPolicyJsonb: { en: '48 hours' },
        basePriceUsd: new Prisma.Decimal('500.00'),
        includedServicesJsonb: { en: ['Transfers'] },
        excludedServicesJsonb: { en: ['Flights'] },
        tags: ['luxury'],
        itineraries: [{
          id: 'day-1',
          dayLabel: 'Arrival',
          descriptionJsonb: { en: 'Meet the guide.' },
          mealsJsonb: { en: 'Dinner' },
          sortOrder: 0,
        }],
        images: [{ id: 'image-1', imageUrl: 'https://cdn.example.test/hero.jpg', isHero: true, altText: 'Hero', sortOrder: 0 }],
      } as any);

      const publicDetail = await service.findBySlug('published-tour', 'en');
      const preview = await service.findPreviewBySlug('published-tour', 'en');

      expect(preview).toMatchObject({
        ...publicDetail,
        preview: { status: 'PUBLISHED', isActive: true, isPublic: true },
      });
    });
  });
});
