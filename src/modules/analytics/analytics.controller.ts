import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';

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
      throw new BadRequestException(`Server-only event '${dto.eventName}' cannot be emitted by public browser client`);
    }

    if (!BROWSER_ALLOWED_EVENTS.has(dto.eventName)) {
      throw new BadRequestException(`Event '${dto.eventName}' is not allowed for public visitor tracking`);
    }

    return this.analyticsService.trackEvent(dto);
  }
}
