import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiParam,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ToursService } from './tours.service';
import {
  GetToursQueryDto,
  GetTourDetailQueryDto,
  CreateTourReviewDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { AuthenticatedUser } from '../../common/types';
import { ParseUuidOrSlugPipe } from '../../common/pipes';
import { TourReviewsQueryDto } from './dto/tour-reviews-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Tours')
@Controller('tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active tours' })
  @ApiOkResponse({ description: 'Paginated list of tours' })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'es', 'pt', 'it', 'ar'],
  })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query() query: GetToursQueryDto) {
    return this.toursService.findAll(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get full tour details by slug' })
  @ApiOkResponse({ description: 'Full tour detail with itinerary and images' })
  @ApiNotFoundResponse({ description: 'Tour not found' })
  @ApiParam({ name: 'slug', type: String })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'es', 'pt', 'it', 'ar'],
  })
  async findBySlug(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: GetTourDetailQueryDto,
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw new BadRequestException('Invalid tour slug');
    }
    return this.toursService.findBySlug(trimmedSlug, query.lang);
  }

  @Get(':slug/reviews')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get published reviews for a tour' })
  @ApiOkResponse({ description: 'Paginated list of reviews' })
  @ApiParam({ name: 'slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTourReviews(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: TourReviewsQueryDto,
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) throw new BadRequestException('Invalid tour slug');
    return this.toursService.getTourReviews(
      trimmedSlug,
      query.page,
      query.limit,
    );
  }

  @Post(':slug/reviews')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 24 * 60 * 60_000 } })
  @ApiOperation({ summary: 'Submit a review for a completed tour' })
  @ApiCreatedResponse({ description: 'Review submitted successfully' })
  @ApiParam({ name: 'slug', type: String })
  async addTourReview(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTourReviewDto,
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) throw new BadRequestException('Invalid tour slug');
    return this.toursService.addTourReview(trimmedSlug, user.id, dto);
  }
}
