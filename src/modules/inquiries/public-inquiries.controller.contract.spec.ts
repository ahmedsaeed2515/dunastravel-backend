import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicInquiriesController } from './public-inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('PublicInquiriesController (HTTP Contract)', () => {
  let app: INestApplication;
  let inquiriesServiceMock: {
    create: jest.Mock;
  };

  beforeAll(async () => {
    inquiriesServiceMock = {
      create: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicInquiriesController],
      providers: [
        {
          provide: InquiriesService,
          useValue: inquiriesServiceMock,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/inquiries accepts valid tailor-made inquiry payload', async () => {
    const validDto = {
      fullName: 'Carlos Santana',
      email: 'carlos@example.com',
      phone: '+34 600 123 456',
      preferredLanguage: 'es',
      destinations: ['Luxor', 'Aswan'],
      startDate: '2028-04-10',
      endDate: '2028-04-20',
      adults: 2,
      children: 0,
      budgetAmount: 3500,
      budgetCurrency: 'EUR',
      notes: 'Prefer 5-star Nile cruise',
    };

    inquiriesServiceMock.create.mockResolvedValue({
      referenceCode: 'INQ-112233',
      ...validDto,
      status: 'NEWLY_RECEIVED',
    });

    const res = await request(app.getHttpServer())
      .post('/api/inquiries')
      .send(validDto)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.referenceCode).toBe('INQ-112233');
    expect(inquiriesServiceMock.create).toHaveBeenCalled();
  });

  it('POST /api/inquiries rejects missing mandatory fields', async () => {
    const invalidDto = {
      // fullName missing
      email: 'invalid-email',
      destinations: [], // min 1 required
    };

    const res = await request(app.getHttpServer())
      .post('/api/inquiries')
      .send(invalidDto)
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
