import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TourLandingPagesService } from './tour-landing-pages.service';

@ApiTags('Public Tour Landing Pages')
@Controller('tour-landing-pages')
export class TourLandingPagesPublicController {
  constructor(private readonly landingPagesService: TourLandingPagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all published active tour landing pages/interfaces' })
  async findAll(@Query() query: any) {
    return this.landingPagesService.findAllPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published active tour landing page by slug' })
  async findOne(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    return this.landingPagesService.findOnePublic(slug, locale);
  }
}
