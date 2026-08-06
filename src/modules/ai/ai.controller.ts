import {
  Controller,
  Post,
  Body,
  UseGuards,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateItineraryDto } from './dto/ai.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AiUsageQuotaService } from './ai-usage-quota.service';

@ApiTags('Admin - AI Concierge')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiUsageQuota: AiUsageQuotaService,
  ) {}

  @Post('itinerary/generate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generate a customized travel itinerary using AI' })
  async generateItinerary(
    @Body() dto: GenerateItineraryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.aiUsageQuota.consume(user.id);
    return this.aiService.generateItinerary(dto);
  }

  @Post('customer/:id/analyze')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Analyze a customer profile using AI to generate CRM insights',
  })
  async analyzeCustomer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.aiUsageQuota.consume(user.id);
    return this.aiService.analyzeCustomer(id);
  }
}
