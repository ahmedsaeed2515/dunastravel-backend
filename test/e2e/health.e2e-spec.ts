import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Health Check (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Since we don't have the real db running reliably in local e2e tests,
  // we just test that the endpoint responds. If DB is down, it returns 503 instead of 200.
  it('GET /api/health/ready should respond with health status', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');

    // Depending on if DB is actually up, it will be 200 or 503
    expect([200, 503]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.status).toBe('ok');
      expect(res.body.db).toBe('reachable');
    } else {
      expect(res.body.status).toBe('degraded');
      expect(res.body.db).toBe('unreachable');
    }
  });
});
