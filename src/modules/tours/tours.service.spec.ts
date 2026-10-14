import { Test, TestingModule } from '@nestjs/testing';
import { ToursService } from './tours.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../common/cache/cache.service';

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
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getOrSet: jest.fn((key, fn) => fn()),
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
          where: expect.objectContaining({
            OR: [{ slug: 'my-tour' }, { id: 'my-tour' }],
            isActive: true,
            status: 'PUBLISHED',
            deletedAt: null,
          }),
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
      const { timestamp, ...restPublicDetail } = publicDetail as any;

      expect(preview).toMatchObject({
        ...restPublicDetail,
        preview: { status: 'PUBLISHED', isActive: true, isPublic: true },
      });
    });

    it('maps relational accommodations and enriches hotelInfo by city', async () => {
      jest.spyOn(prisma.tour, 'findFirst').mockResolvedValue({
        id: 'tour-acc',
        slug: 'luxury-egypt',
        status: 'PUBLISHED',
        isActive: true,
        currency: 'USD',
        titleJsonb: { en: 'Luxury Egypt' },
        durationJsonb: { en: '7 days' },
        overviewJsonb: { en: 'Overview' },
        basePriceUsd: new Prisma.Decimal('1200.00'),
        itineraries: [],
        images: [],
        accommodations: [
          {
            id: 'acc-1',
            hotelId: 'hotel-1',
            roomId: 'room-1',
            city: 'Cairo',
            categoryTier: 'Luxury',
            nights: 3,
            dayFrom: 1,
            dayTo: 4,
            priceSupplementUsd: new Prisma.Decimal('150.00'),
            isDefault: true,
            notesJsonb: { en: 'Nile view guaranteed' },
            sortOrder: 0,
            hotel: {
              id: 'hotel-1',
              slug: 'four-seasons-cairo',
              nameJsonb: { en: 'Four Seasons Cairo' },
              city: 'Cairo',
              country: 'Egypt',
              starRating: 5,
              heroImageUrl: 'https://cdn.example.test/fs.jpg',
              images: [],
            },
            room: {
              id: 'room-1',
              slug: 'nile-suite',
              nameJsonb: { en: 'Nile Suite' },
              roomType: 'Suite',
              capacity: 2,
              basePriceUsd: new Prisma.Decimal('450.00'),
              currency: 'USD',
              heroImageUrl: null,
              seasonPricings: [],
            },
          },
        ],
      } as any);

      const detail = await service.findBySlug('luxury-egypt', 'en');
      expect(detail.accommodations).toHaveLength(1);
      expect(detail.accommodations?.[0]).toMatchObject({
        city: 'Cairo',
        destination: 'Cairo',
        categoryTier: 'Luxury',
        nights: 3,
        priceSupplementUsd: '150.00',
        priceSupplement: 150,
        hotel: expect.objectContaining({ name: 'Four Seasons Cairo', starRating: 5, stars: 5 }),
        room: expect.objectContaining({ name: 'Nile Suite', basePriceUsd: '450.00', ratePerNight: 450 }),
      });
      expect(detail.hotelInfo).toMatchObject({
        hotels: { Cairo: ['Four Seasons Cairo'] },
      });
    });

    it('filters out soft-deleted or archived hotels and rooms on public findBySlug (BUG-08)', async () => {
      jest.spyOn(prisma.tour, 'findFirst').mockResolvedValue({
        id: 'tour-acc-filter',
        slug: 'filtered-egypt',
        status: 'PUBLISHED',
        isActive: true,
        currency: 'USD',
        titleJsonb: { en: 'Filtered Egypt' },
        durationJsonb: { en: '5 days' },
        overviewJsonb: { en: 'Overview' },
        basePriceUsd: new Prisma.Decimal('900.00'),
        itineraries: [],
        images: [],
        accommodations: [
          {
            id: 'acc-deleted-hotel',
            hotelId: 'hotel-del',
            roomId: null,
            destination: 'Cairo',
            nights: 2,
            priceSupplementUsd: new Prisma.Decimal('0.00'),
            hotel: {
              id: 'hotel-del',
              slug: 'deleted-hotel',
              nameJsonb: { en: 'Deleted Hotel' },
              city: 'Cairo',
              stars: 5,
              status: 'ARCHIVED',
              isActive: false,
              deletedAt: new Date(),
            },
            room: null,
          },
          {
            id: 'acc-active-hotel-deleted-room',
            hotelId: 'hotel-ok',
            roomId: 'room-del',
            destination: 'Luxor',
            nights: 3,
            priceSupplementUsd: new Prisma.Decimal('50.00'),
            hotel: {
              id: 'hotel-ok',
              slug: 'active-hotel',
              nameJsonb: { en: 'Active Luxor Hotel' },
              city: 'Luxor',
              stars: 4,
              status: 'PUBLISHED',
              isActive: true,
              deletedAt: null,
            },
            room: {
              id: 'room-del',
              slug: 'deleted-room',
              nameJsonb: { en: 'Deleted Room' },
              ratePerNight: new Prisma.Decimal('180.00'),
              currency: 'USD',
              maxOccupancy: 2,
              isActive: false,
              deletedAt: new Date(),
              seasonPricings: [],
            },
          },
        ],
      } as any);

      const detail = await service.findBySlug('filtered-egypt', 'en');
      expect(detail.accommodations).toHaveLength(1);
      expect(detail.accommodations?.[0]?.hotel?.slug).toBe('active-hotel');
      expect(detail.accommodations?.[0]?.hotel?.stars).toBe(4);
      expect(detail.accommodations?.[0]?.room).toBeNull();
      expect(detail.accommodations?.[0]?.roomId).toBeNull();
    });
  });
});
