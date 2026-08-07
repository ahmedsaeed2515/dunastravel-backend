import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BookingsService } from '../bookings/bookings.service';
import { ContactSubmissionsService } from '../contact-submissions/contact-submissions.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';

import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';

describe('AdminController (Roles & Permissions Contract)', () => {
  let app: INestApplication;
  let currentRole: string;

  beforeAll(async () => {
    currentRole = 'USER';

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listBookings: jest.fn().mockResolvedValue({ data: [], meta: {} }),
            suspendUser: jest
              .fn()
              .mockResolvedValue({ id: 'usr-1', suspendedAt: new Date() }),
            activateUser: jest.fn().mockResolvedValue({ id: 'usr-1' }),
          },
        },
        {
          provide: BookingsService,
          useValue: {
            createBooking: jest.fn(),
          },
        },
        {
          provide: ContactSubmissionsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], meta: {} }),
            findById: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    })

      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
          req.user = { id: 'usr-test', role: currentRole };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useClass(RolesGuard)
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
    if (app) {
      await app.close();
    }
  });

  describe('RBAC Role Matrix Validation', () => {
    it('should reject standard USER access to admin endpoints with 403 Forbidden', async () => {
      currentRole = 'USER';

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/admin/bookings');

      expect(response.status).toBe(403);
    });

    it('should allow ADMIN role to access general admin endpoints', async () => {
      currentRole = 'ADMIN';

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/admin/bookings');

      expect(response.status).toBe(200);
    });

    it('should reject ADMIN role from SUPER_ADMIN user suspension endpoint with 403 Forbidden', async () => {
      currentRole = 'ADMIN';

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/admin/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/suspend')
        .send({ reason: 'Policy violation' });

      expect(response.status).toBe(403);
    });

    it('should allow SUPER_ADMIN role to execute user suspension', async () => {
      currentRole = 'SUPER_ADMIN';

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/admin/users/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/suspend')
        .send({ reason: 'Policy violation' });

      expect(response.status).toBe(201);
    });
  });
});
