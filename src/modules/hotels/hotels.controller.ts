import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HotelsService } from './hotels.service';
import { PublicHotelsQueryDto } from './dto/hotel-query.dto';

@ApiTags('hotels')
@Controller('hotels')
@Public()
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOperation({ summary: 'List published, active hotels' })
  @ApiQuery({ name: 'locale', required: false, type: String })
  @ApiQuery({ name: 'destinationSlug', required: false, type: String })
  async findAll(@Query() query: PublicHotelsQueryDto) {
    return this.hotelsService.findAllPublic(query.locale ?? 'en', query.destinationSlug, query.limit);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published, active hotel by slug' })
  async findOne(@Param('slug') slug: string, @Query() query: PublicHotelsQueryDto) {
    return this.hotelsService.findOnePublic(slug, query.locale ?? 'en');
  }
}
