import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('tours-availability')
@Controller('tours/:slug/availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Get availability for a tour' })
  async getAvailability(@Param('slug') slug: string) {
    if (!slug) throw new BadRequestException('Tour slug is required');
    return this.availabilityService.getAvailability(slug);
  }
}
