import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { isAllowedBrowserOrigin } from './allowed-origin.util';
import express from 'express';

describe('SEC-01: CORS Middleware & Preflight Integration (Supertest)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'nodeEnv') return 'production';
              if (
                key === 'corsAllowedOrigins' ||
                key === 'CORS_ALLOWED_ORIGINS'
              ) {
                return 'https://www.dunastravel.com,https://admin.dunastravel.com';
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    const configService = moduleRef.get<ConfigService>(ConfigService);
    app = moduleRef.createNestApplication();

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) return callback(null, true);
        if (isAllowedBrowserOrigin(origin, configService)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    const httpAdapter = app.getHttpAdapter();
    const router = express.Router();
    router.get('/api/test-endpoint', (req, res) => res.json({ ok: true }));
    router.post('/api/payments/webhook/getpayin', (req, res) =>
      res.json({ received: true }),
    );
    httpAdapter.use(router);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Preflight OPTIONS from allowed origin returns Allow-Origin and Allow-Credentials', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/test-endpoint')
      .set('Origin', 'https://www.dunastravel.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe(
      'https://www.dunastravel.com',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('Preflight OPTIONS from evil origin does NOT return Access-Control-Allow-Origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/test-endpoint')
      .set('Origin', 'https://evil-test.vercel.app')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('Direct GET request from evil origin does NOT reflect Allow-Origin header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test-endpoint')
      .set('Origin', 'https://evil-test.vercel.app');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('Webhook server-to-server POST without Origin succeeds with unchanged behavior', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/getpayin')
      .send({ event: 'charge.succeeded' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
