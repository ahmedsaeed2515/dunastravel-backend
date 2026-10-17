import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../users/users.service';
import { WalletsController } from '../wallets/wallets.controller';
import { WalletsService } from '../wallets/wallets.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { UserRole } from '@prisma/client';

describe('Auth & Authorization Security Contract (AUTH-SEC, BFLA, MASS)', () => {
  let app: INestApplication;
  let authServiceMock: jest.Mocked<Partial<AuthService>>;
  let walletsServiceMock: jest.Mocked<Partial<WalletsService>>;
  let auditServiceMock: jest.Mocked<Partial<AuditService>>;

  let simulatedUserRole: UserRole | null = null;
  let simulatedUserId: string | null = null;

  beforeEach(async () => {
    simulatedUserRole = null;
    simulatedUserId = null;

    authServiceMock = {
      register: jest.fn().mockResolvedValue({
        id: 'usr-100',
        name: 'Secured User',
        email: 'secured@example.com',
        phone: '+1234567890',
        role: UserRole.USER,
        status: 'ACTIVE',
        isVerified: true,
        createdAt: new Date().toISOString(),
      }),
      login: jest.fn(),
      refresh: jest.fn(),
      clearRefreshToken: jest.fn(),
      getMe: jest.fn(),
      generateToken: jest.fn().mockReturnValue('mock-jwt-access-token'),
      generateRefreshToken: jest
        .fn()
        .mockResolvedValue('mock-jwt-refresh-token'),
    };

    walletsServiceMock = {
      reconcileWallets: jest.fn().mockResolvedValue({
        totalWalletsChecked: 5,
        driftCount: 0,
        reconciledAt: new Date().toISOString(),
      }),
      addTransaction: jest.fn().mockResolvedValue({
        id: 'tx-100',
        amount: 500,
        status: 'COMPLETED',
      } as any),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({} as any),
    };

    const mockJwtAuthGuard = {
      canActivate: jest.fn((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers['authorization'];
        if (!auth || !auth.startsWith('Bearer valid-')) {
          throw new UnauthorizedException('Authentication required');
        }
        req.user = {
          id: simulatedUserId || 'usr-default',
          email: 'test@example.com',
          role: simulatedUserRole || UserRole.USER,
        };
        return true;
      }),
    };

    const mockRolesGuard = new RolesGuard({
      getAllAndOverride: (key: string, targets: any[]) => {
        const handlerName = targets[0]?.name;
        if (handlerName === 'addManualTransaction') {
          return [UserRole.SUPER_ADMIN];
        }
        return [UserRole.ADMIN];
      },
    } as any);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, WalletsController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: string) => {
              if (key === 'nodeEnv') return 'test';
              return defaultVal;
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
          },
        },
        { provide: WalletsService, useValue: walletsServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
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

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('AUTH-SEC-001: Deny-by-default on protected endpoints', () => {
    it('rejects unauthenticated calls to admin finance endpoints with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/finance/wallets/reconcile')
        .send({});

      expect(response.status).toBe(401);
      expect(walletsServiceMock.reconcileWallets).not.toHaveBeenCalled();
    });

    it('rejects malformed Bearer tokens with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/finance/wallets/reconcile')
        .set('Authorization', 'Bearer invalid-signature-token')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('BFLA-001 through BFLA-003: Function-Level Authorization', () => {
    it('BFLA-001: rejects regular USER calling ADMIN wallet reconcile endpoint with 403', async () => {
      simulatedUserRole = UserRole.USER;
      simulatedUserId = 'usr-regular';

      const response = await request(app.getHttpServer())
        .post('/admin/finance/wallets/reconcile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({});

      expect(response.status).toBe(403);
      expect(walletsServiceMock.reconcileWallets).not.toHaveBeenCalled();
    });

    it('BFLA-002: rejects AGENT calling ADMIN wallet reconcile endpoint with 403', async () => {
      simulatedUserRole = UserRole.AGENT;
      simulatedUserId = 'usr-agent';

      const response = await request(app.getHttpServer())
        .post('/admin/finance/wallets/reconcile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({});

      expect(response.status).toBe(403);
      expect(walletsServiceMock.reconcileWallets).not.toHaveBeenCalled();
    });

    it('BFLA-003: allows ADMIN to reconcile but rejects ADMIN from SUPER_ADMIN manual transaction', async () => {
      simulatedUserRole = UserRole.ADMIN;
      simulatedUserId = 'usr-admin';

      const reconcileRes = await request(app.getHttpServer())
        .post('/admin/finance/wallets/reconcile')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({});
      expect(reconcileRes.status).toBe(201);
      expect(walletsServiceMock.reconcileWallets).toHaveBeenCalled();

      const manualRes = await request(app.getHttpServer())
        .post('/admin/finance/wallets/transactions/manual')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          ownerType: 'COMPANY',
          ownerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          type: 'CREDIT',
          amount: 500,
          referenceId: 'ADJUST-001',
        });
      expect(manualRes.status).toBe(403);
    });

    it('allows SUPER_ADMIN to execute manual transaction', async () => {
      simulatedUserRole = UserRole.SUPER_ADMIN;
      simulatedUserId = 'usr-super-admin';

      const manualRes = await request(app.getHttpServer())
        .post('/admin/finance/wallets/transactions/manual')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          ownerType: 'COMPANY',
          ownerId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          type: 'CREDIT',
          amount: 500,
          referenceId: 'ADJUST-001',
        });

      expect(manualRes.status).toBe(201);
      expect(walletsServiceMock.addTransaction).toHaveBeenCalled();
    });
  });

  describe('MASS-001: Mass Assignment Prevention', () => {
    it('rejects registration payload with unexpected escalated fields (role, isVerified)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'Password123!',
          phone: '+1234567890',
          role: 'SUPER_ADMIN',
          isVerified: true,
          walletBalance: 100000,
        });

      expect(response.status).toBe(400);
      expect(authServiceMock.register).not.toHaveBeenCalled();
    });
  });
});
