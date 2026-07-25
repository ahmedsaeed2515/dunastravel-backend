import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const BROWSER_ALLOWED_EVENTS = new Set([
  'page_view',
  'interface_view',
  'tour_impression',
  'tour_card_click',
  'tour_view',
  'booking_started',
  'booking_step_completed',
  'payment_started',
  'inquiry_submitted',
]);

const SERVER_ONLY_EVENTS = new Set([
  'booking_submitted',
  'booking_confirmed',
  'booking_cancelled',
  'payment_succeeded',
  'payment_failed',
  'refund_completed',
]);

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Track a privacy-aware website visitor event.' })
  @ApiOkResponse({ description: 'Event tracked successfully' })
  async trackEvent(@Body() dto: TrackEventDto) {
    if (SERVER_ONLY_EVENTS.has(dto.eventName)) {
      throw new BadRequestException(
        `Server-only event '${dto.eventName}' cannot be emitted by public browser client`,
      );
    }

    if (!BROWSER_ALLOWED_EVENTS.has(dto.eventName)) {
      throw new BadRequestException(
        `Event '${dto.eventName}' is not allowed for public visitor tracking`,
      );
    }

    return this.analyticsService.trackEvent(dto);
  }
}

@ApiTags('Admin — Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get overall analytics summary and revenue metrics',
  })
  async getSummary() {
    return this.analyticsService.getSummaryAdmin();
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Get time-series analytics metrics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getTimeSeries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTimeSeriesAdmin(startDate, endDate);
  }

  @Get('top-tours')
  @ApiOperation({ summary: 'Get top viewed tours' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopTours(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.analyticsService.getTopToursAdmin(limit || 10);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get conversion funnel metrics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getFunnel(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getFunnelAdmin(startDate, endDate);
  }
}
