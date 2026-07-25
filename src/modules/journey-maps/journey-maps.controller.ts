import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JourneyMapsService } from './journey-maps.service';

@ApiTags('Journey Maps')
@Controller('journey-maps')
export class JourneyMapsController {
  constructor(private readonly journeyMapsService: JourneyMapsService) {}

  @Get('tour/:tourId')
  @ApiOperation({ summary: 'Get journey route for a tour' })
  @ApiParam({ name: 'tourId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'The journey route details' })
  @ApiNotFoundResponse()
  async getByTourId(@Param('tourId', ParseUUIDPipe) tourId: string) {
    return this.journeyMapsService.findByTourIdPublic(tourId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journey route by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'The journey route details' })
  @ApiNotFoundResponse()
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.journeyMapsService.findOnePublic(id);
  }
}
