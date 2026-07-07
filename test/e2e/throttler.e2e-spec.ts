import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    
    // Replace express with any type to set trust proxy
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Note: we can't fully run e2e with Prisma unless DB is up, so this test might fail
  // depending on local setup, but it verifies the ThrottlerGuard logic is active.
  it('should return 429 after exceeding limit', async () => {
    const limit = 100; // Default global limit is 100

    // The global rate limit is applied to all routes
    for (let i = 0; i < limit; i++) {
      await request(app.getHttpServer()).get('/api/admin/currency/rates');
    }

    // The (limit + 1)th request must be rate-limited
    const res = await request(app.getHttpServer()).get('/api/admin/currency/rates');

    // Assuming throttling catches it
    expect(res.status).toBe(429);
  });
});
