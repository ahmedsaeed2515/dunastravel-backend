/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(dto: TrackEventDto) {
    try {
      const event = await this.prisma.analyticsEvent.create({
        data: {
          eventId: dto.eventId,
          eventName: dto.eventName,
          sessionId: dto.sessionId,
          userId: dto.userId,
          interfaceSlug: dto.interfaceSlug,
          tourSlug: dto.tourSlug,
          bookingRef: dto.bookingRef,
          locale: dto.locale || 'en',
          pathname: dto.pathname,
          referrer: dto.referrer,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          deviceCategory: dto.deviceCategory || 'desktop',
          properties: dto.properties ? dto.properties : undefined,
        },
      });

      return { success: true, eventId: event.id };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return { success: true, deduplicated: true };
      }
      this.logger.error(`Failed to track analytics event: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
