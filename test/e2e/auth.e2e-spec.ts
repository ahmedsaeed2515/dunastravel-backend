import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    name: 'E2E Test User',
    email: `e2e-auth-${Date.now()}@test.com`,
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test user
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate email with 409', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should reject invalid email with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...testUser, email: 'not-an-email' })
        .expect(400);
    });

    it('should reject short password with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ ...testUser, email: 'other@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject unverified user with 401', async () => {
      // By default isVerified = false � login should be blocked
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401);
    });

    it('should login after manual verification and set cookies', async () => {
      // Manually verify the user in DB to simulate email verification
      await prisma.user.update({
        where: { email: testUser.email },
        data: { isVerified: true },
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(
        true,
      );
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(
        true,
      );
    });

    it('should reject wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword!' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessCookie: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      accessCookie =
        (res.headers['set-cookie'] as unknown as string[]).find((c: string) =>
          c.startsWith('access_token='),
        ) ?? '';
    });

    it('should return current user when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', accessCookie)
        .expect(200);

      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear cookies on logout', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const cookie =
        (loginRes.headers['set-cookie'] as unknown as string[]).find(
          (c: string) => c.startsWith('access_token='),
        ) ?? '';

      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      const setCookies = logoutRes.headers['set-cookie'] as unknown as string[];
      // Cookies should be cleared (Max-Age=0 or Expires in past)
      expect(
        setCookies.some(
          (c: string) =>
            c.includes('Max-Age=0') || c.includes('access_token=;'),
        ),
      ).toBe(true);
    });
  });
});
