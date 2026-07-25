import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuditModule } from './audit.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Audit HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockLog = {
    id: 'log-1',
    actorId: 'usr-admin-1',
    actorRole: 'ADMIN',
    action: 'BOOKING_UPDATED',
    entityType: 'BOOKING',
    entityId: 'bkg-100',
    metadata: { status: 'CONFIRMED' },
    ipAddress: '127.0.0.1',
    userAgent: 'NestJS Test',
    createdAt: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuditModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        auditLog: {
          findMany: jest.fn().mockResolvedValue([mockLog]),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(mockLog),
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

  it('GET /api/admin/audit-log returns paginated audit log entries', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/audit-log')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items[0].id).toBe('log-1');
    expect(items[0].action).toBe('BOOKING_UPDATED');
  });
});
