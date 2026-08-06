import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject } from 'class-validator';

export class SendChatMessageDto {
  @ApiProperty({ description: 'Visitor text message content', example: 'Recommend a 5-day Nile Cruise tour' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ description: 'Public session identifier', example: 'session-xyz-123' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiPropertyOptional({ description: 'Message locale', example: 'en' })
  @IsString()
  @IsOptional()
  locale?: string;

  @ApiPropertyOptional({ description: 'Context of the page currently viewed by visitor' })
  @IsObject()
  @IsOptional()
  pageContext?: {
    tourSlug?: string;
    destinationSlug?: string;
    pathname?: string;
  };

  @ApiPropertyOptional({ description: 'Visitor voluntarily supplied contact information' })
  @IsObject()
  @IsOptional()
  visitorInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  };
}

export class SubmitLeadDto {
  @ApiProperty({ description: 'Public session identifier' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'Visitor full name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Visitor email address' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: 'Visitor phone or WhatsApp number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Visitor country of residence or nationality' })
  @IsString()
  @IsOptional()
  nationality?: string;
}

export class HandoffRequestDto {
  @ApiProperty({ description: 'Public session identifier' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
