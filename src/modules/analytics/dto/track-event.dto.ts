import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class TrackEventDto {
  @ApiProperty({ description: 'Unique deduplication event ID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: 'Event name (e.g. page_view, tour_view, booking_started)' })
  @IsString()
  @IsNotEmpty()
  eventName!: string;

  @ApiPropertyOptional({ description: 'Anonymous session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Authenticated user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Landing page interface slug' })
  @IsOptional()
  @IsString()
  interfaceSlug?: string;

  @ApiPropertyOptional({ description: 'Tour slug' })
  @IsOptional()
  @IsString()
  tourSlug?: string;

  @ApiPropertyOptional({ description: 'Booking reference code' })
  @IsOptional()
  @IsString()
  bookingRef?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: 'URL path' })
  @IsOptional()
  @IsString()
  pathname?: string;

  @ApiPropertyOptional({ description: 'HTTP Referrer URL' })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional({ description: 'UTM Source' })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional({ description: 'UTM Medium' })
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional({ description: 'UTM Campaign' })
  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @ApiPropertyOptional({ description: 'Device category (desktop, mobile, tablet)' })
  @IsOptional()
  @IsString()
  deviceCategory?: string;

  @ApiPropertyOptional({ description: 'Additional custom properties' })
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;
}
