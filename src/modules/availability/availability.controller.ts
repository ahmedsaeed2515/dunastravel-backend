import { Controller, Get, Param } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { ParseUuidOrSlugPipe } from '../../common/pipes';

@ApiTags('tours-availability')
@Controller('tours/:slug/availability')
@Public()
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get availability for a tour' })
  async getAvailability(@Param('slug', ParseUuidOrSlugPipe) slug: string) {
    return this.availabilityService.getAvailability(slug);
  }
}
