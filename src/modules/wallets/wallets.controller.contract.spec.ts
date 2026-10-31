import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';
import { WalletOwnerType, WalletTransactionType } from '@prisma/client';

describe('WalletsController (HTTP Contract)', () => {
  let app: INestApplication;
  let walletsServiceMock: {
    getMetrics: jest.Mock;
    listWallets: jest.Mock;
    reconcileWallets: jest.Mock;
    getWalletTransactions: jest.Mock;
    getOrCreateWallet: jest.Mock;
    addTransaction: jest.Mock;
  };
  let auditServiceMock: {
    log: jest.Mock;
  };

  beforeAll(async () => {
    walletsServiceMock = {
      getMetrics: jest.fn(),
      listWallets: jest.fn(),
      reconcileWallets: jest.fn(),
      getWalletTransactions: jest.fn(),
      getOrCreateWallet: jest.fn(),
      addTransaction: jest.fn(),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WalletsController],
      providers: [
        { provide: WalletsService, useValue: walletsServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
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

  it('GET /api/admin/finance/wallets/metrics returns aggregated liability metrics', async () => {
    walletsServiceMock.getMetrics.mockResolvedValue({
      totalWallets: 15,
      totalLiabilityUsd: 45000,
      activeWalletsCount: 12,
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/finance/wallets/metrics')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalLiabilityUsd).toBe(45000);
  });

  it('GET /api/admin/finance/wallets lists wallets with search and pagination', async () => {
    walletsServiceMock.listWallets.mockResolvedValue({
      data: [{ id: 'w-1', balance: 1200, currency: 'USD' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const res = await request(app.getHttpServer())
      .get('/api/admin/finance/wallets?page=1&limit=10')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(walletsServiceMock.listWallets).toHaveBeenCalled();
  });

  it('POST /api/admin/finance/wallets/reconcile triggers reconciliation and logs audit', async () => {
    walletsServiceMock.reconcileWallets.mockResolvedValue({
      totalWalletsChecked: 10,
      driftCount: 0,
      message: 'Reconciliation complete',
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/finance/wallets/reconcile')
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WALLET_LEDGER_RECONCILED',
        entityType: 'Wallet',
      }),
    );
  });

  it('GET /api/admin/finance/wallets/:ownerType/:ownerId gets or initializes wallet', async () => {
    const ownerId = '44444444-4444-4444-8444-444444444444';
    walletsServiceMock.getOrCreateWallet.mockResolvedValue({
      id: 'w-44',
      ownerType: WalletOwnerType.COMPANY,
      ownerId,
      balance: 500,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/admin/finance/wallets/COMPANY/${ownerId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(walletsServiceMock.getOrCreateWallet).toHaveBeenCalledWith(
      WalletOwnerType.COMPANY,
      ownerId,
    );
  });

  it('POST /api/admin/finance/wallets/transactions/manual creates manual credit transaction and logs audit', async () => {
    const ownerId = '55555555-5555-4555-8555-555555555555';
    const dto = {
      ownerType: WalletOwnerType.COMPANY,
      ownerId,
      amount: 250,
      type: WalletTransactionType.CREDIT,
      description: 'Manual adjustment credit',
    };

    walletsServiceMock.addTransaction.mockResolvedValue({
      id: 'tx-manual-1',
      ...dto,
      status: 'COMPLETED',
    });

    const res = await request(app.getHttpServer())
      .post('/api/admin/finance/wallets/transactions/manual')
      .send(dto)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(walletsServiceMock.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: WalletOwnerType.COMPANY,
        ownerId,
        amount: 250,
        type: WalletTransactionType.CREDIT,
        referenceType: 'MANUAL',
      }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MANUAL_WALLET_TRANSACTION_CREATED',
        entityType: 'WalletTransaction',
      }),
    );
  });
});
