import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health/liveness should respond with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/liveness');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/readiness should respond with health status', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/readiness');

    // Depending on if DB is actually up, it will be 200 or 503
    expect([200, 503]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.status).toBe('ok');
    }
  });
});
