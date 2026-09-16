import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import request from 'supertest';

import { ReviewsModule } from './reviews.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Reviews HTTP Contract Spec', () => {
  let app: INestApplication;
  let mockPrisma: any;

  const mockTourId = '11111111-1111-4111-8111-111111111111';
  const mockReviewId = '22222222-2222-4222-8222-222222222222';
  const mockBookingId = '33333333-3333-4333-8333-333333333333';
  const mockUserId = '44444444-4444-4444-8444-444444444444';

  const mockBooking = {
    id: mockBookingId,
    userId: mockUserId,
    tourId: mockTourId,
    status: 'COMPLETED',
  };

  const mockReview = {
    id: mockReviewId,
    tourId: mockTourId,
    userId: mockUserId,
    bookingId: mockBookingId,
    rating: 5,
    reviewerName: 'Customer John',
    comment: 'Exceptional luxury experience!',
    adminReply: null,
    status: 'PENDING',
    isPublished: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    tour: { id: mockTourId, slug: 'nile-cruise', titleJsonb: { en: 'Nile Cruise Adventure' } },
    user: { id: mockUserId, name: 'Customer John', email: 'john@example.com' },
  };

  beforeAll(async () => {
    mockPrisma = {
      tourReview: {
        findMany: jest.fn().mockResolvedValue([mockReview]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(mockReview),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { rating: 5.0 },
          _count: { rating: 1 },
        }),
        create: jest.fn().mockResolvedValue(mockReview),
        update: jest.fn().mockResolvedValue({
          ...mockReview,
          status: 'APPROVED',
          isPublished: true,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      tour: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockTourId,
          slug: 'nile-cruise',
          titleJsonb: { en: 'Nile Cruise Adventure' },
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: mockTourId,
          slug: 'nile-cruise',
          titleJsonb: { en: 'Nile Cruise Adventure' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(mockBooking),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), ReviewsModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
        ...mockPrisma,
        $transaction: jest.fn(async (cb: any) =>
          typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb),
        ),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<{ user: Record<string, unknown> }>();
          req.user = { id: mockUserId, role: 'USER', email: 'john@example.com', name: 'Customer John' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseTransformInterceptor(new Reflector()));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/tours/:tourId/reviews returns public published reviews & rating summary', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tours/${mockTourId}/reviews`)
      .expect(200);

    const body = res.body.data || res.body;
    expect(body.items || body.data).toBeDefined();
    expect(body.ratingSummary).toBeDefined();
    expect(body.ratingSummary.averageRating).toBe(5);
  });

  it('POST /api/tours/:tourId/reviews allows authenticated customer to submit review', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tours/${mockTourId}/reviews`)
      .send({
        rating: 5,
        comment: 'Great luxury tour experience!',
      })
      .expect(201);

    const review = res.body.data || res.body;
    expect(review.id).toBe(mockReviewId);
    expect(review.userId).toBe(mockUserId);
  });

  it('POST /api/tours/:tourId/reviews rejects duplicate review submission with 409 Conflict', async () => {
    mockPrisma.tourReview.findFirst.mockResolvedValueOnce(mockReview);

    const res = await request(app.getHttpServer())
      .post(`/tours/${mockTourId}/reviews`)
      .send({
        rating: 5,
        comment: 'Attempting a second review for the same trip.',
      })
      .expect(409);

    expect(res.body.message).toContain('already reviewed');
  });

  it('GET /api/admin/reviews returns admin moderation list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/reviews')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].id).toBe(mockReviewId);
  });

  it('GET /api/admin/reviews/:id returns single review by ID for deep linking', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/reviews/${mockReviewId}`)
      .expect(200);

    const review = res.body.data || res.body;
    expect(review.id).toBe(mockReviewId);
    expect(review.tour).toBeDefined();
  });

  it('GET /api/admin/reviews with reviewId filter returns targeted review', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/reviews?reviewId=${mockReviewId}`)
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
  });

  it('PATCH /api/admin/reviews/:id/status updates review status to APPROVED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admin/reviews/${mockReviewId}/status`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const review = res.body.data || res.body;
    expect(review.status).toBe('APPROVED');
    expect(review.isPublished).toBe(true);
  });
});
