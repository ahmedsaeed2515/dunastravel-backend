import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { CmsModule } from './cms.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('CMS HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockBlock = {
    id: 'cms-1',
    key: 'homepage.hero',
    content: {
      en: 'Welcome to Dunas Travel',
      ar: 'مرحبا بكم في دوناس ترافيل',
    },
    lastUpdatedBy: 'admin-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CmsModule, CacheModule.register()],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        cmsBlock: {
          findUnique: jest.fn().mockResolvedValue(mockBlock),
          findMany: jest.fn().mockResolvedValue([mockBlock]),
          count: jest.fn().mockResolvedValue(1),
          upsert: jest.fn().mockResolvedValue(mockBlock),
          delete: jest.fn().mockResolvedValue(mockBlock),
        },
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(new ResponseTransformInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/cms/:key returns public CMS block', async () => {
    const res = await request(app.getHttpServer())
      .get('/cms/homepage.hero')
      .expect(200);

    const block = res.body.data || res.body;
    expect(block.key).toBe('homepage.hero');
  });

  it('GET /api/admin/cms-blocks returns admin list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/cms-blocks')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].key).toBe('homepage.hero');
  });

  it('PUT /api/admin/cms-blocks/:key upserts CMS block', async () => {
    const res = await request(app.getHttpServer())
      .put('/admin/cms-blocks/homepage.hero')
      .send({
        content: { en: 'Updated Banner' },
      })
      .expect(200);

    const block = res.body.data || res.body;
    expect(block.key).toBe('homepage.hero');
  });
});
