import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JourneyMapsModule } from './journey-maps.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Journey Maps HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockRoute = {
    id: 'route-1',
    name: 'Nile Cruise Highlights',
    pointsJsonb: [
      { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
      { lat: 25.6872, lng: 32.6396, label: 'Luxor' },
    ],
    tourId: '00000000-0000-0000-0000-000000000001',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockTour = {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'nile-cruise',
    titleJsonb: { en: 'Luxury Nile Cruise' },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JourneyMapsModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        journeyRoute: {
          findFirst: jest.fn().mockResolvedValue(mockRoute),
          findUnique: jest.fn().mockResolvedValue(mockRoute),
          findMany: jest.fn().mockResolvedValue([mockRoute]),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(mockRoute),
          update: jest.fn().mockResolvedValue(mockRoute),
          delete: jest.fn().mockResolvedValue(mockRoute),
        },
        tour: {
          findUnique: jest.fn().mockResolvedValue(mockTour),
          findFirst: jest.fn().mockResolvedValue(mockTour),
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

  it('GET /api/journey-maps/tour/:tourId returns journey route for tour', async () => {
    const res = await request(app.getHttpServer())
      .get('/journey-maps/tour/00000000-0000-0000-0000-000000000001')
      .expect(200);

    const body = res.body.data || res.body;
    expect(body.id).toBe('route-1');
    expect(body.name).toBe('Nile Cruise Highlights');
  });

  it('GET /api/admin/journey-maps returns admin paginated list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/journey-maps')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items[0].id).toBe('route-1');
  });

  it('POST /api/admin/journey-maps creates a new journey route with validated coordinates', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/journey-maps')
      .send({
        name: 'Nile Cruise Highlights',
        points: [
          { lat: 30.0444, lng: 31.2357, label: 'Cairo' },
          { lat: 25.6872, lng: 32.6396, label: 'Luxor' },
        ],
        tourId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      })
      .expect(201);

    const body = res.body.data || res.body;
    expect(body.id).toBe('route-1');
  });
});
