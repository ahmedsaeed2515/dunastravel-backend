import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TourLandingPagesService } from './tour-landing-pages.service';
import { Public } from '../../common/decorators/public.decorator';
import {
  PublicTourLandingPagesQueryDto,
  TourLandingPageDetailQueryDto,
} from './dto/list-tour-landing-pages.dto';
import { ParseUuidOrSlugPipe } from '../../common/pipes';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Public Tour Landing Pages')
// Public destination routes are owned by `DestinationsController`; this
// controller owns the generic landing-page collection.
@Controller('tour-landing-pages')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class TourLandingPagesPublicController {
  constructor(private readonly landingPagesService: TourLandingPagesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all published active tour landing pages/interfaces',
  })
  async findAll(@Query() query: PublicTourLandingPagesQueryDto) {
    return this.landingPagesService.findAllPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published active tour landing page by slug' })
  async findOne(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: TourLandingPageDetailQueryDto,
  ) {
    return this.landingPagesService.findOnePublic(
      slug,
      query.locale ?? 'en',
    );
  }
}
