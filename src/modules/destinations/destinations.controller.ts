import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  DestinationsService,
  PublicDestinationsQueryDto,
} from './destinations.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Public Destinations')
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all published active destinations',
  })
  @ApiOkResponse({ description: 'List of active published destinations' })
  async findAll(@Query() query: PublicDestinationsQueryDto) {
    return this.destinationsService.findAllPublic(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'Get a published active destination by slug' })
  @ApiOkResponse({ description: 'Destination detail with attached tours' })
  async findOne(
    @Param('slug') slug: string,
    @Query('locale') locale: string = 'en',
  ) {
    return this.destinationsService.findOnePublic(slug, locale);
  }
}
