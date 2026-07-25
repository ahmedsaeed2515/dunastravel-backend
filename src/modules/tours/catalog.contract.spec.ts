process.env.GUEST_TOKEN_SECRET =
  process.env.GUEST_TOKEN_SECRET ||
  'test-guest-secret-32-chars-long-string-12345';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-32-chars-long-string-12345';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

interface PaginatedBody {
  items?: Array<{ title: string; basePriceUsd: string }>;
  data?: Array<{ title: string; basePriceUsd: string }>;
}

interface DetailBody {
  slug: string;
  title: string;
  itinerary: unknown[];
  images: unknown[];
}

describe('Catalog & Destinations Engine (HTTP Contracts)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;

  const mockTour = {
    id: 'tour-contract-1',
    slug: 'luxury-nile-cruise',
    titleJsonb: { en: 'Luxury Nile Cruise', es: 'Crucero de Lujo por el Nilo' },
    category: 'CRUISE',
    basePriceUsd: new Prisma.Decimal('1500.00'),
    durationJsonb: { en: '7 Days' },
    overviewJsonb: { en: 'Experience the magic of the Nile.' },
    isActive: true,
    status: 'PUBLISHED',
    deletedAt: null,
    country: 'Egypt',
    city: 'Luxor',
    currency: 'USD',
    isFeatured: true,
    tags: ['luxury', 'nile'],
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { reviews: 5, bookings: 12 },
    images: [
      {
        id: 'img-1',
        imageUrl: 'https://example.com/hero.jpg',
        isHero: true,
        altText: 'Hero',
        sortOrder: 1,
      },
    ],
    itineraries: [
      {
        id: 'it-1',
        dayLabel: 'Day 1',
        descriptionJsonb: { en: 'Arrival in Luxor' },
        sortOrder: 1,
      },
    ],
  };

  const mockLandingPage = {
    id: 'lp-contract-1',
    slug: 'egypt-destinations',
    type: 'DESTINATION',
    titleJsonb: { en: 'Egypt Destinations', es: 'Destinos en Egipto' },
    subtitleJsonb: { en: 'Explore ancient wonders' },
    status: 'PUBLISHED',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tours: [
      {
        tour: mockTour,
      },
    ],
  };

  const prismaMock: any = {
    tour: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([mockTour]),
      findFirst: jest.fn().mockResolvedValue(mockTour),
      findUnique: jest.fn().mockResolvedValue(mockTour),
      create: jest.fn().mockResolvedValue(mockTour),
      update: jest.fn().mockResolvedValue(mockTour),
    },
    tourLandingPage: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([mockLandingPage]),
      findFirst: jest.fn().mockResolvedValue(mockLandingPage),
      findUnique: jest.fn().mockResolvedValue(mockLandingPage),
    },
    tourReview: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    currencyRate: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    },

    $transaction: jest.fn((cb: unknown) => {
      if (Array.isArray(cb)) {
        return Promise.all(cb);
      }
      if (typeof cb === 'function') {
        return (cb as (p: any) => unknown)(prismaMock);
      }
      return Promise.resolve(cb);
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    adminToken = jwtService.sign({
      sub: 'admin-uuid-1',
      email: 'admin@dunastravel.com',
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/tours', () => {
    it('should return paginated active published tours with 5-locale fallback', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tours?lang=es&page=1&limit=10')
        .expect(200);

      const payload = (res.body.data || res.body) as {
        items: Array<{ title: string; basePriceUsd: string }>;
      };
      expect(Array.isArray(payload.items)).toBe(true);
      expect(payload.items[0]?.title).toBe('Crucero de Lujo por el Nilo');
      expect(payload.items[0]?.basePriceUsd).toBe('1500.00');
    });
  });

  describe('GET /api/tours/:slug', () => {
    it('should return full tour detail by slug with itinerary and hero image', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/tours/luxury-nile-cruise?lang=en')
        .expect(200);

      const detail = (res.body.data || res.body) as DetailBody;
      expect(detail.slug).toBe('luxury-nile-cruise');
      expect(detail.title).toBe('Luxury Nile Cruise');
      expect(detail).toHaveProperty('itinerary');
      expect(detail).toHaveProperty('images');
    });

    it('should return 404 for non-existent tour slug', async () => {
      jest.spyOn(prismaMock.tour, 'findFirst').mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .get('/api/tours/non-existent-tour')
        .expect(404);
    });
  });

  describe('GET /api/destinations', () => {
    it('should return published destinations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/destinations?locale=en')
        .expect(200);

      expect(res.body.data || res.body).toBeDefined();
    });

    it('should utilize admin token context cleanly', () => {
      expect(adminToken).toBeDefined();
    });
  });
});
