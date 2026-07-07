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
import { GetToursQueryDto, GetTourDetailQueryDto, CreateTourReviewDto } from './dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Tours')
@Controller('tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
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
    @Param('slug') slug: string,
    @Query() query: GetTourDetailQueryDto,
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw new BadRequestException('Invalid tour slug');
    }
    return this.toursService.findBySlug(trimmedSlug, query.lang);
  }

  @Get(':slug/reviews')
  @ApiOperation({ summary: 'Get published reviews for a tour' })
  @ApiOkResponse({ description: 'Paginated list of reviews' })
  @ApiParam({ name: 'slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTourReviews(
    @Param('slug') slug: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) throw new BadRequestException('Invalid tour slug');
    return this.toursService.getTourReviews(trimmedSlug, parseInt(page, 10), parseInt(limit, 10));
  }

  @Post(':slug/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a review for a completed tour' })
  @ApiCreatedResponse({ description: 'Review submitted successfully' })
  @ApiParam({ name: 'slug', type: String })
  async addTourReview(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTourReviewDto,
  ) {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) throw new BadRequestException('Invalid tour slug');
    return this.toursService.addTourReview(trimmedSlug, user.id, dto);
  }
}
