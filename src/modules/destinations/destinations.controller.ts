import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { DestinationsService } from './destinations.service';
import { PublicTourLandingPagesQueryDto } from '../tours/dto/list-tour-landing-pages.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ParseUuidOrSlugPipe } from '../../common/pipes';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Public Destinations')
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Get all published active destinations',
  })
  @ApiOkResponse({ description: 'List of active published destinations' })
  async findAll(@Query() query: PublicTourLandingPagesQueryDto) {
    return this.destinationsService.findAllPublic(query);
  }

  @Get(':slug')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get a published active destination by slug' })
  @ApiOkResponse({ description: 'Destination detail with attached tours' })
  async findOne(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: LocaleQueryDto,
  ) {
    return this.destinationsService.findOnePublic(slug, query.locale);
  }
}
