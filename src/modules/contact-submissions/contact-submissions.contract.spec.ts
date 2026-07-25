process.env.GUEST_TOKEN_SECRET =
  process.env.GUEST_TOKEN_SECRET ||
  'test-guest-secret-32-chars-long-string-12345';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-32-chars-long-string-12345';
process.env.NODE_ENV = 'test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Contact Submissions Engine (HTTP Contracts)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;

  const mockSubmission = {
    id: 1,
    referenceCode: 'CON-A1B2C3',
    status: 'NEW',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    subject: 'General Inquiry',
    message: 'Hello, I would like to inquire about tour availability.',
    locale: 'en',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prismaMock = {
    contactSubmission: {
      create: jest.fn().mockResolvedValue(mockSubmission),
      findUnique: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { id?: number | string; referenceCode?: string };
          }) => {
            if (where.id || where.referenceCode === 'CON-A1B2C3') {
              return Promise.resolve(mockSubmission);
            }
            return Promise.resolve(null);
          },
        ),
      findMany: jest.fn().mockResolvedValue([mockSubmission]),
      count: jest.fn().mockResolvedValue(1),
      update: jest
        .fn()
        .mockResolvedValue({ ...mockSubmission, status: 'READ' }),
    },
    emailTemplate: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    notificationLog: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@dunastravel.com',
        name: 'Admin User',
        role: UserRole.ADMIN,
        status: 'ACTIVE',
      }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    adminToken = jwtService.sign({
      sub: 'admin-uuid-1',
      email: 'admin@dunastravel.com',
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/contact', () => {
    it('should receive public contact submission and return reference code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/contact')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          subject: 'Tour Questions',
          message: 'Can I request a custom itinerary for Luxor?',
          locale: 'en',
        })
        .expect(201);

      const body =
        (res.body as { data?: { referenceCode: string; message: string } })
          .data ?? res.body;
      expect(body.referenceCode).toBeDefined();
      expect(body.message).toContain('received');
    });

    it('should reject invalid email in contact submission', async () => {
      await request(app.getHttpServer())
        .post('/api/contact')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',
          subject: 'Test',
          message: 'Hello world',
        })
        .expect(400);
    });
  });

  describe('GET /api/admin/contact-submissions', () => {
    it('should allow admin to list contact submissions with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/contact-submissions?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const items = (res.body as { data: { items: unknown[] } }).data.items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/contact-submissions/:id', () => {
    it('should allow admin to view detail of a contact submission', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/contact-submissions/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const detail = (res.body as { data: { referenceCode: string } }).data;
      expect(detail.referenceCode).toBe('CON-A1B2C3');
    });
  });

  describe('PATCH /api/admin/contact-submissions/:id/status', () => {
    it('should allow admin to update submission status', async () => {
      prismaMock.contactSubmission.update.mockResolvedValueOnce({
        ...mockSubmission,
        status: 'READ',
      });

      const res = await request(app.getHttpServer())
        .patch('/api/admin/contact-submissions/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'READ' })
        .expect(200);

      const detail = (res.body as { data: { status: string } }).data;
      expect(detail.status).toBe('READ');
    });
  });
});
