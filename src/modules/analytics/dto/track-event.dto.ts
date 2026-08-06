import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';

export class TrackEventDto {
  @ApiProperty({ description: 'Unique deduplication event ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  eventId!: string;

  @ApiProperty({
    description: 'Event name (e.g. page_view, tour_view, booking_started)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/)
  eventName!: string;

  @ApiPropertyOptional({ description: 'Anonymous session ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/)
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Landing page interface slug' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  interfaceSlug?: string;

  @ApiPropertyOptional({ description: 'Tour slug' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tourSlug?: string;

  @ApiPropertyOptional({ description: 'Booking reference code' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z0-9-]+$/)
  bookingRef?: string;

  @ApiPropertyOptional({ description: 'Language code' })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  locale?: string;

  @ApiPropertyOptional({ description: 'URL path' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^\/[^\s?#]*$/)
  pathname?: string;

  @ApiPropertyOptional({ description: 'HTTP Referrer URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  referrer?: string;

  @ApiPropertyOptional({ description: 'UTM Source' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @ApiPropertyOptional({ description: 'UTM Medium' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @ApiPropertyOptional({ description: 'UTM Campaign' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;

  @ApiPropertyOptional({
    description: 'Device category (desktop, mobile, tablet)',
  })
  @IsOptional()
  @IsString()
  @IsIn(['desktop', 'mobile', 'tablet'])
  deviceCategory?: string;

  @ApiPropertyOptional({ description: 'Additional custom properties' })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
