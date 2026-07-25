import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

describe('Availability HTTP API Contract (Supertest)', () => {
  let app: INestApplication;
  let availabilityServiceMock: jest.Mocked<Partial<AvailabilityService>>;

  const mockAvailabilityResponse = {
    tour: { id: 'tour-1', titleJsonb: { en: 'Luxury Tour' } },
    availabilities: [
      {
        id: 'avail-1',
        tourId: 'tour-1',
        date: '2026-09-01',
        totalCapacity: 30,
        remainingSeats: 25,
        status: 'AVAILABLE',
      },
    ],
  };

  beforeAll(async () => {
    availabilityServiceMock = {
      getAvailability: jest.fn().mockImplementation((slug: string) => {
        if (slug === 'luxury-tour') {
          return Promise.resolve(mockAvailabilityResponse);
        }
        throw new BadRequestException('Tour not found');
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [
        {
          provide: AvailabilityService,
          useValue: availabilityServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/tours/:slug/availability', () => {
    it('returns 200 OK with availability dates for valid tour slug', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/tours/luxury-tour/availability')
        .expect(200);

      const body = res.body as ApiResponse<typeof mockAvailabilityResponse>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockAvailabilityResponse);
      expect(availabilityServiceMock.getAvailability).toHaveBeenCalledWith(
        'luxury-tour',
      );
    });

    it('returns 400 Bad Request when tour slug is not found', async () => {
      const res = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/api/tours/unknown-tour/availability')
        .expect(400);

      const body = res.body as ApiResponse;
      expect(body.success).toBe(false);
    });
  });
});
