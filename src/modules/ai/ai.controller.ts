import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateItineraryDto } from './dto/ai.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { Throttle } from '@nestjs/throttler';

@ApiTags('Admin - AI Concierge')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('itinerary/generate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generate a customized travel itinerary using AI' })
  async generateItinerary(@Body() dto: GenerateItineraryDto) {
    return this.aiService.generateItinerary(dto);
  }

  @Post('customer/:id/analyze')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Analyze a customer profile using AI to generate CRM insights',
  })
  async analyzeCustomer(@Param('id') id: string) {
    return this.aiService.analyzeCustomer(id);
  }
}
