import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../users/users.service';
import { JwtAuthGuard } from '../../common/guards';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { ExecutionContext } from '@nestjs/common';

describe('AuthController (HTTP Contract)', () => {
  let app: INestApplication;
  let registerMock: jest.Mock;
  let loginMock: jest.Mock;
  let refreshMock: jest.Mock;
  let clearRefreshTokenMock: jest.Mock;
  let getMeMock: jest.Mock;

  beforeAll(async () => {
    registerMock = jest.fn();
    loginMock = jest.fn();
    refreshMock = jest.fn();
    clearRefreshTokenMock = jest.fn();
    getMeMock = jest.fn();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: registerMock,
            login: loginMock,
            refresh: refreshMock,
            clearRefreshToken: clearRefreshTokenMock,
            getMe: getMeMock,
            generateToken: jest.fn().mockReturnValue('mock-jwt-access-token'),
            generateRefreshToken: jest
              .fn()
              .mockResolvedValue('mock-jwt-refresh-token'),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            verifyEmail: jest.fn(),
            changePassword: jest.fn(),
            resendVerification: jest.fn(),
          },
        },
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
            updateProfile: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<Record<string, unknown>>();
          req.user = { id: 'usr-123', role: 'USER' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
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

  describe('POST /api/auth/register', () => {
    it('should register a new user and set access/refresh cookies', async () => {
      registerMock.mockResolvedValue({
        id: 'usr-new',
        email: 'test@example.com',
        role: 'USER',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      const cookies = response.get('Set-Cookie') || [];
      expect(cookies.some((c) => c.includes('access_token'))).toBe(true);
      expect(cookies.some((c) => c.includes('refresh_token'))).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user and return 200 with cookies', async () => {
      loginMock.mockResolvedValue({
        id: 'usr-123',
        email: 'test@example.com',
        role: 'USER',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      const cookies = response.get('Set-Cookie') || [];
      expect(cookies.some((c) => c.includes('access_token'))).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should rotate tokens when valid refresh_token cookie is supplied', async () => {
      refreshMock.mockResolvedValue({
        user: { id: 'usr-123' },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/auth/refresh')
        .set('Cookie', ['refresh_token=old-refresh-token']);

      expect(response.status).toBe(200);
      const cookies = response.get('Set-Cookie') || [];
      expect(cookies.some((c) => c.includes('access_token'))).toBe(true);
    });

    it('should reject refresh request if refresh_token cookie is missing', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).post('/api/auth/refresh');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/csrf', () => {
    it('should issue CSRF token cookie', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/auth/csrf');

      expect(response.status).toBe(200);
      const cookies = response.get('Set-Cookie') || [];
      expect(cookies.some((c) => c.includes('csrf_token'))).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user profile', async () => {
      getMeMock.mockResolvedValue({
        id: 'usr-123',
        email: 'test@example.com',
        role: 'USER',
      });

      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/api/auth/me');

      expect(response.status).toBe(200);
    });
  });
});
