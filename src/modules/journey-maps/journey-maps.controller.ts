import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JourneyMapsService } from './journey-maps.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Journey Maps')
@Controller('journey-maps')
@Public()
export class JourneyMapsController {
  constructor(private readonly journeyMapsService: JourneyMapsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public journey routes' })
  @ApiOkResponse({ description: 'List of public journey routes' })
  async getAll() {
    return this.journeyMapsService.findAllPublic();
  }

  @Get('tour/:tourId')
  @ApiOperation({ summary: 'Get journey route for a tour' })
  @ApiParam({ name: 'tourId', type: 'string' })
  @ApiOkResponse({ description: 'The journey route details' })
  @ApiNotFoundResponse()
  async getByTourId(@Param('tourId') tourId: string) {
    return this.journeyMapsService.findByTourIdPublic(tourId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journey route by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'The journey route details' })
  @ApiNotFoundResponse()
  async getById(@Param('id') id: string) {
    return this.journeyMapsService.findOnePublic(id);
  }
}
