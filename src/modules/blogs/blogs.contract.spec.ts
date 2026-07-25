import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { BlogsModule } from './blogs.module';

import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { RolesGuard } from '../../common/guards/roles.guard';

import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Blogs HTTP Contract Spec', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockArticle = {
    id: 'art-1',
    slug: 'pyramids-guide-2026',
    titleJsonb: {
      en: 'Complete Pyramids Guide 2026',
      ar: 'دليل الأهرامات الكامل 2026',
    },
    contentJsonb: {
      en: '<p>Discover the ancient wonder.</p>',
      ar: '<p>اكتشف عجائب التاريخ.</p>',
    },
    excerptJsonb: { en: 'Discover the ancient wonder.' },
    seoTitleJsonb: { en: 'Pyramids Guide 2026' },
    seoDescriptionJsonb: { en: 'Explore Pyramids of Giza.' },
    coverImage: 'https://example.com/pyramids.jpg',
    author: 'Dunas Travel Expert',
    category: 'Guides',
    tags: ['egypt', 'pyramids'],
    status: 'PUBLISHED',
    isPublished: true,
    publishedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [BlogsModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        blogArticle: {
          findMany: jest.fn().mockResolvedValue([mockArticle]),
          findFirst: jest.fn().mockResolvedValue(mockArticle),
          findUnique: jest
            .fn()
            .mockImplementation(({ where }: { where: { slug: string } }) => {
              if (where?.slug === 'luxor-temples-guide') return Promise.resolve(null);
              return Promise.resolve(mockArticle);
            }),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(mockArticle),
          update: jest.fn().mockResolvedValue(mockArticle),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        },
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(
      new ResponseTransformInterceptor(app.get(Reflector)),
    );
    await app.init();
    prisma = moduleRef.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/blogs returns public list with localized titles', async () => {
    const res = await request(app.getHttpServer())
      .get('/blogs?locale=en')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].slug).toBe('pyramids-guide-2026');
    expect(items[0].title).toBe('Complete Pyramids Guide 2026');
  });

  it('GET /api/blogs/:slug returns single article detail', async () => {
    const res = await request(app.getHttpServer())
      .get('/blogs/pyramids-guide-2026?locale=ar')
      .expect(200);

    const article = res.body.data || res.body;
    expect(article.slug).toBe('pyramids-guide-2026');
    expect(article.title).toBe('دليل الأهرامات الكامل 2026');
  });

  it('GET /api/admin/blogs returns admin list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/blogs')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].id).toBe('art-1');
  });

  it('POST /api/admin/blogs creates new blog article', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/blogs')
      .send({
        slug: 'luxor-temples-guide',
        titleJsonb: { en: 'Luxor Temples Guide' },
        contentJsonb: { en: '<p>Explore Luxor</p>' },
        status: 'PUBLISHED',
      })
      .expect(201);

    const article = res.body.data || res.body;
    expect(article.slug).toBe('pyramids-guide-2026');
  });
});
