import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';
import { CommissionStatus } from '@prisma/client';

describe('CommissionsController (HTTP Contract)', () => {
  let app: INestApplication;
  let commissionsServiceMock: {
    getMetrics: jest.Mock;
    findAll: jest.Mock;
    createCommission: jest.Mock;
    updateCommissionStatus: jest.Mock;
  };
  let auditServiceMock: {
    log: jest.Mock;
  };

  beforeAll(async () => {
    commissionsServiceMock = {
      getMetrics: jest.fn(),
      findAll: jest.fn(),
      createCommission: jest.fn(),
      updateCommissionStatus: jest.fn(),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CommissionsController],
      providers: [
        {
          provide: CommissionsService,
          useValue: commissionsServiceMock,
        },
        {
          provide: AuditService,
          useValue: auditServiceMock,
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

  it('GET /api/admin/finance/commissions/metrics returns commission metrics', async () => {
    commissionsServiceMock.getMetrics.mockResolvedValue({
      totalPendingUsd: 1200,
      totalApprovedUsd: 4500,
      pendingCount: 3,
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/finance/commissions/metrics')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      totalPendingUsd: 1200,
      totalApprovedUsd: 4500,
      pendingCount: 3,
    });
  });

  it('GET /api/admin/finance/commissions lists commissions with pagination', async () => {
    commissionsServiceMock.findAll.mockResolvedValue({
      data: [
        {
          id: 'comm-1',
          rate: 10,
          amount: 100,
          status: 'PENDING',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/finance/commissions?page=1&limit=10')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(commissionsServiceMock.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('POST /api/admin/finance/commissions validates body and logs audit', async () => {
    const validDto = {
      bookingId: '11111111-1111-4111-8111-111111111111',
      companyId: '22222222-2222-4222-8222-222222222222',
      rate: 10,
      amount: 250,
    };

    commissionsServiceMock.createCommission.mockResolvedValue({
      id: 'comm-new-1',
      ...validDto,
      status: 'PENDING',
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/finance/commissions')
      .send(validDto)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(commissionsServiceMock.createCommission).toHaveBeenCalledWith(
      validDto,
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'usr-admin-1',
        action: 'COMMISSION_MANUALLY_CREATED',
        entityType: 'Commission',
      }),
    );
  });

  it('PATCH /api/admin/finance/commissions/:id/status updates status and logs audit', async () => {
    const commId = '33333333-3333-4333-8333-333333333333';
    commissionsServiceMock.updateCommissionStatus.mockResolvedValue({
      id: commId,
      status: CommissionStatus.APPROVED,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/finance/commissions/${commId}/status`)
      .send({ status: CommissionStatus.APPROVED })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(commissionsServiceMock.updateCommissionStatus).toHaveBeenCalledWith(
      commId,
      { status: CommissionStatus.APPROVED },
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMMISSION_STATUS_CHANGED_TO_APPROVED',
        entityType: 'Commission',
        entityId: commId,
      }),
    );
  });
});
