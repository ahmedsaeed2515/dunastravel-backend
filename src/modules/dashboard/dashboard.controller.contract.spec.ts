import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';

describe('DashboardController (HTTP Contract)', () => {
  let app: INestApplication;
  let dashboardServiceMock: {
    getOverview: jest.Mock;
    getExecutiveSummary: jest.Mock;
    getActionCenter: jest.Mock;
    getRecentBookings: jest.Mock;
    getRecentActivity: jest.Mock;
    getRevenueTrend: jest.Mock;
    getBookingsTrend: jest.Mock;
    getTourPerformance: jest.Mock;
    getTopDestinations: jest.Mock;
    getInterfacePerformance: jest.Mock;
    getConversionFunnel: jest.Mock;
    getTrafficAnalytics: jest.Mock;
  };

  beforeAll(async () => {
    dashboardServiceMock = {
      getOverview: jest
        .fn()
        .mockResolvedValue({ status: 'ok', mock: 'overview' }),
      getExecutiveSummary: jest.fn().mockResolvedValue({
        revenue: { grossRevenue: 10000, currency: 'USD' },
        bookings: { total: 20 },
      }),
      getActionCenter: jest
        .fn()
        .mockResolvedValue([
          { id: 'alert-pending-bookings', severity: 'high', count: 3 },
        ]),
      getRecentBookings: jest
        .fn()
        .mockResolvedValue([
          { id: 'bk-1', referenceCode: 'DUNAS-2026-001', travelersCount: 2 },
        ]),
      getRecentActivity: jest
        .fn()
        .mockResolvedValue([{ id: 'act-1', action: 'BOOKING_CREATED' }]),
      getRevenueTrend: jest.fn().mockResolvedValue([]),
      getBookingsTrend: jest.fn().mockResolvedValue([]),
      getTourPerformance: jest
        .fn()
        .mockResolvedValue({ all: [], rankings: {} }),
      getTopDestinations: jest.fn().mockResolvedValue([]),
      getInterfacePerformance: jest.fn().mockResolvedValue([]),
      getConversionFunnel: jest.fn().mockResolvedValue({}),
      getTrafficAnalytics: jest.fn().mockResolvedValue({}),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
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

  it('GET /api/admin/dashboard/summary - returns executive summary metrics wrapped in standardized envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/summary?preset=30d&currency=USD')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.revenue.grossRevenue).toBe(10000);
    expect(dashboardServiceMock.getExecutiveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ preset: '30d', currency: 'USD' }),
    );
  });

  it('GET /api/admin/dashboard/overview - returns complete consolidated overview payload', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/overview')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(dashboardServiceMock.getOverview).toHaveBeenCalled();
  });

  it('GET /api/admin/dashboard/action-center - returns operational action center alerts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/action-center')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('alert-pending-bookings');
  });

  it('GET /api/admin/dashboard/recent-bookings - returns top recent bookings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/recent-bookings')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data[0].referenceCode).toBe('DUNAS-2026-001');
  });

  it('GET /api/admin/dashboard/summary?currency=INVALID - rejects invalid currency filter with 400', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/dashboard/summary?currency=BITCOIN')
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(dashboardServiceMock.getExecutiveSummary).not.toHaveBeenCalled();
  });
});
