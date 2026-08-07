import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { FaqModule } from './faq.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('FAQ HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockFaq = {
    id: 'faq-1',
    questionJsonb: {
      en: 'What is included in the package?',
      ar: 'ماذا يتضمن البرنامج؟',
    },
    answerJsonb: {
      en: 'All transfers and luxury hotel stays.',
      ar: 'جميع التنقلات والإقامة الفندقية الفاخرة.',
    },
    category: 'General',
    sortOrder: 1,
    isPublished: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [FaqModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: jest
          .fn()
          .mockImplementation((promises) => Promise.all(promises)),
        faqItem: {
          findMany: jest.fn().mockResolvedValue([mockFaq]),
          findFirst: jest.fn().mockResolvedValue(mockFaq),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(mockFaq),
          update: jest.fn().mockResolvedValue(mockFaq),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/faq returns public localized FAQ items', async () => {
    const res = await request(app.getHttpServer())
      .get('/faq?locale=en')
      .expect(200);

    const items = res.body.data || res.body;
    expect(Array.isArray(items)).toBe(true);
    expect(items[0].question).toBe('What is included in the package?');
    expect(items[0].answer).toBe('All transfers and luxury hotel stays.');
  });

  it('GET /api/admin/faq returns admin list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/faq')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].id).toBe('faq-1');
  });

  it('POST /api/admin/faq creates new FAQ item', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/faq')
      .send({
        questionJsonb: { en: 'Is visa assistance included?' },
        answerJsonb: { en: 'Yes, full support is provided.' },
        category: 'Visa',
      })
      .expect(201);

    const item = res.body.data || res.body;
    expect(item.id).toBe('faq-1');
  });

  it('PATCH /api/admin/faq/reorder updates sort order', async () => {
    const res = await request(app.getHttpServer())
      .patch('/admin/faq/reorder')
      .send({
        items: [{ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', sortOrder: 5 }],
      })
      .expect(200);

    const result = res.body.data || res.body;
    expect(result.success).toBe(true);
  });
});
