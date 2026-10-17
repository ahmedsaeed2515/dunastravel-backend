import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TourLandingPagesService } from './tour-landing-pages.service';

import { CacheService } from '../../common/cache/cache.service';

const actor = { id: 'admin-id', role: 'SUPER_ADMIN' } as any;
const landingPage = {
  id: 'landing-id',
  slug: 'egypt',
  type: 'DESTINATION',
  titleJsonb: { en: 'Egypt', ar: 'مصر' },
  subtitleJsonb: {},
  descriptionJsonb: { en: 'Explore Egypt' },
  briefJsonb: {},
  heroImageUrl: 'https://cdn.example.test/egypt.jpg',
  heroVideoUrl: null,
  seoTitleJsonb: { en: 'Egypt SEO' },
  seoDescriptionJsonb: { en: 'Egypt description' },
  seoKeywordsJsonb: {},
  sectionsJsonb: [],
  status: 'PUBLISHED',
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  deletedAt: null,
};

describe('TourLandingPagesService', () => {
  let service: TourLandingPagesService;
  let prisma: any;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TourLandingPagesService,
        {
          provide: PrismaService,
          useValue: {
            tourLandingPage: {
              count: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            tour: { findMany: jest.fn() },
            tourLandingPageTour: {
              count: jest.fn(),
              deleteMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
              upsert: jest.fn(),
            },
            $transaction: jest.fn((value: any) =>
              Array.isArray(value) ? Promise.all(value) : value({}),
            ),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            invalidatePrefix: jest.fn(),
            getOrSet: jest.fn().mockImplementation((key, fn) => fn()),
          },
        },
      ],
    }).compile();
    service = module.get(TourLandingPagesService);
    prisma = module.get(PrismaService);
    audit = module.get(AuditService);
  });

  it('returns only active published public destinations and asks Prisma for stable ordering', async () => {
    prisma.tourLandingPage.count.mockResolvedValue(0);
    prisma.tourLandingPage.findMany.mockResolvedValue([]);
    await expect(
      service.findAllPublic({ type: 'DESTINATION', locale: 'it' }),
    ).resolves.toEqual(
      expect.objectContaining({
        data: [],
        meta: expect.objectContaining({ page: 1 }),
      }),
    );
    expect(prisma.tourLandingPage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'DESTINATION',
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('projects hero, SEO, localized fields, and relation order without exposing invisible tours', async () => {
    prisma.tourLandingPage.findFirst.mockResolvedValue({
      ...landingPage,
      tours: [
        {
          sortOrder: 4,
          isFeatured: true,
          isVisible: true,
          customBadge: { en: 'Popular' },
          tour: {
            id: 'tour-id',
            slug: 'nile',
            titleJsonb: { en: 'Nile cruise', ar: 'رحلة النيل' },
            overviewJsonb: { en: 'A cruise' },
            durationJsonb: { en: '4 days' },
            basePriceUsd: new Prisma.Decimal('1200.00'),
            currency: 'USD',
            country: 'Egypt',
            city: 'Luxor',
            category: 'CRUISE',
            isFeatured: false,
            images: [
              { imageUrl: 'https://cdn.example.test/nile.jpg', isHero: true },
            ],
          },
        },
      ],
    });
    const result = await service.findOnePublic('egypt', 'ar');
    expect(result).toMatchObject({
      title: 'مصر',
      heroImageUrl: 'https://cdn.example.test/egypt.jpg',
      seoTitle: 'Egypt SEO',
      tours: [
        {
          slug: 'nile',
          title: 'رحلة النيل',
          duration: '4 days',
          basePriceUsd: '1200.00',
          sortOrder: 4,
          customBadge: 'Popular',
        },
      ],
    });
    expect(prisma.tourLandingPage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'egypt',
          status: 'PUBLISHED',
          isActive: true,
          deletedAt: null,
        },
      }),
    );
  });

  it.each([
    ['en', 'Egypt'],
    ['ar', 'مصر'],
    ['es', 'Egipto'],
    ['pt', 'Egito'],
    ['it', 'Egitto'],
  ])(
    'uses the %s locale for active public destination records',
    async (locale, expectedTitle) => {
      prisma.tourLandingPage.findFirst.mockResolvedValue({
        ...landingPage,
        titleJsonb: {
          en: 'Egypt',
          ar: 'مصر',
          es: 'Egipto',
          pt: 'Egito',
          it: 'Egitto',
        },
        tours: [],
      });
      await expect(
        service.findOnePublic('egypt', locale),
      ).resolves.toMatchObject({ title: expectedTitle, tours: [] });
    },
  );

  it('reports incomplete locale content to the admin list instead of treating it as complete', async () => {
    prisma.tourLandingPage.count.mockResolvedValue(1);
    prisma.tourLandingPage.findMany.mockResolvedValue([
      {
        ...landingPage,
        titleJsonb: { en: 'Egypt' },
        descriptionJsonb: { en: 'Explore Egypt' },
        tours: [],
      },
    ]);
    const result = await service.findAllAdmin({ type: 'DESTINATION' });
    expect(result.data[0].translationCompletion.ar).toEqual({
      title: false,
      subtitle: false,
      description: false,
      isComplete: false,
    });
  });

  it('rejects an already-used slug before a create can write a duplicate', async () => {
    prisma.tourLandingPage.findUnique.mockResolvedValue(landingPage);
    await expect(
      service.createAdmin(
        { slug: 'egypt', titleJsonb: { en: 'Egypt' } } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not silently overwrite a landing page when the editor version is stale', async () => {
    prisma.tourLandingPage.findFirst.mockResolvedValue(landingPage);
    await expect(
      service.updateAdmin(
        'egypt',
        { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('audits a successful detach while retaining the global tour record', async () => {
    prisma.tourLandingPage.findFirst.mockResolvedValue(landingPage);
    prisma.tourLandingPageTour.deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      service.detachTour(
        'egypt',
        '00000000-0000-4000-8000-000000000001',
        actor,
      ),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.tourLandingPageTour.deleteMany).toHaveBeenCalledWith({
      where: {
        landingPageId: 'landing-id',
        tourId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TOUR_LANDING_PAGE_TOUR_DETACHED',
        entityId: 'landing-id',
      }),
    );
  });
});
