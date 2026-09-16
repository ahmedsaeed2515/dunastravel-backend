import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReviewQueryDto } from './dto/review-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('reviews')
@Controller('tours')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':tourId/reviews')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get published reviews for a tour by ID or Slug' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findTourReviews(
    @Param('tourId') tourId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findTourReviewsPublic(
      tourId,
      query.page,
      query.limit,
    );
  }

  @Post(':tourId/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Submit an authenticated customer review for a tour (pending moderation)',
  })
  async createReview(
    @Param('tourId') tourId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.createCustomerReview(tourId, user, dto);
  }
}


