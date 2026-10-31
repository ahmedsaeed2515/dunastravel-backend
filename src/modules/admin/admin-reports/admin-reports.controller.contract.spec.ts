import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ExecutionContext } from '@nestjs/common';

describe('AdminReportsController (HTTP Contract)', () => {
  let app: INestApplication;
  let adminReportsServiceMock: {
    getBookingsTrend: jest.Mock;
    getRevenueTrend: jest.Mock;
    getDestinationsReport: jest.Mock;
  };

  beforeAll(async () => {
    adminReportsServiceMock = {
      getBookingsTrend: jest.fn().mockResolvedValue([
        {
          period: '2026-01-01T00:00:00.000Z',
          total: 15,
          confirmed: 12,
          pending: 2,
          completed: 1,
          cancelled: 0,
        },
      ]),
      getRevenueTrend: jest.fn().mockResolvedValue([
        {
          period: '2026-01-01T00:00:00.000Z',
          grossRevenue: 25000,
          totalRevenue: 24500,
          collectedRevenue: 24500,
          bookingsCount: 12,
          currency: 'USD',
        },
      ]),
      getDestinationsReport: jest.fn().mockResolvedValue([
        {
          location: 'Cairo, Egypt',
          country: 'Egypt',
          city: 'Cairo',
          bookingCount: 5,
          tourCount: 2,
        },
      ]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [
        { provide: AdminReportsService, useValue: adminReportsServiceMock },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<any>();
          req.user = { id: 'usr-admin-1', role: 'ADMIN' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
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

  it('GET /api/admin/reports/bookings-trend - returns time-series bookings trend array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/reports/bookings-trend?period=monthly')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].total).toBe(15);
    expect(adminReportsServiceMock.getBookingsTrend).toHaveBeenCalledWith(
      'monthly',
    );
  });

  it('GET /api/admin/reports/revenue - returns time-series revenue trend array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/reports/revenue?period=weekly')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].grossRevenue).toBe(25000);
    expect(adminReportsServiceMock.getRevenueTrend).toHaveBeenCalledWith(
      'weekly',
    );
  });

  it('GET /api/admin/reports/destinations - returns destination performance breakdown', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/reports/destinations')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data[0].location).toBe('Cairo, Egypt');
    expect(adminReportsServiceMock.getDestinationsReport).toHaveBeenCalled();
  });
});
