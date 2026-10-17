import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ToursService } from './tours.service';
import { GetToursQueryDto, GetTourDetailQueryDto } from './dto';
import { Public } from '../../common/decorators';
import { ParseUuidOrSlugPipe } from '../../common/pipes';

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
}
