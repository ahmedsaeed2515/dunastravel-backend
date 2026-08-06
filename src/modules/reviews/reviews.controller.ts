import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { Public } from '../../common/decorators/public.decorator';
import { ReviewQueryDto } from './dto/review-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('tours/:tourId/reviews')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get published reviews for a tour' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findTourReviews(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findTourReviewsPublic(
      tourId,
      query.page,
      query.limit,
    );
  }

  @Post('tours/:tourId/reviews')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Submit a verified customer review for a completed tour',
  })
  async createReview(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.createCustomerReview(tourId, user.id, dto);
  }
}
