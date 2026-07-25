import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';

import { ReviewsModule } from './reviews.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Reflector } from '@nestjs/core';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';

describe('Reviews HTTP Contract Spec', () => {
  let app: INestApplication;

  const mockBooking = {
    id: 'bkg-100',
    userId: 'usr-1',
    tourId: 'tour-55',
    status: 'COMPLETED',
  };

  const mockReview = {
    id: 'rev-1',
    tourId: 'tour-55',
    userId: 'usr-1',
    bookingId: 'bkg-100',
    rating: 5,
    reviewerName: 'Customer John',
    comment: 'Exceptional luxury experience!',
    adminReply: null,
    status: 'PENDING',
    isPublished: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ReviewsModule],
      providers: [PrismaService],
    })
      .overrideProvider(PrismaService)
      .useValue({
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
        },
        booking: {
          findUnique: jest.fn().mockResolvedValue(mockBooking),
        },
        auditLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        },
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<{ user: Record<string, unknown> }>();
          req.user = { id: 'usr-1', role: 'USER', email: 'john@example.com' };
          return true;
        },
      })
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

  it('GET /api/tours/:tourId/reviews returns public published reviews & rating summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/tours/tour-55/reviews')
      .expect(200);

    const body = res.body.data || res.body;
    expect(body.items || body.data).toBeDefined();
    expect(body.ratingSummary).toBeDefined();
    expect(body.ratingSummary.averageRating).toBe(5);
  });

  it('POST /api/tours/:tourId/reviews allows verified customer with completed booking to submit review', async () => {
    const res = await request(app.getHttpServer())
      .post('/tours/tour-55/reviews')
      .send({
        bookingId: 'bkg-100',
        rating: 5,
        comment: 'Great tour experience!',
      })
      .expect(201);

    const review = res.body.data || res.body;
    expect(review.id).toBe('rev-1');
  });

  it('GET /api/admin/reviews returns admin moderation list', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/reviews')
      .expect(200);

    const items = res.body.data?.items || res.body.data;
    expect(items).toBeDefined();
    expect(items[0].id).toBe('rev-1');
  });

  it('PATCH /api/admin/reviews/:id/status updates review status to APPROVED', async () => {
    const res = await request(app.getHttpServer())
      .patch('/admin/reviews/rev-1/status')
      .send({ status: 'APPROVED' })
      .expect(200);

    const review = res.body.data || res.body;
    expect(review.status).toBe('APPROVED');
    expect(review.isPublished).toBe(true);
  });
});
