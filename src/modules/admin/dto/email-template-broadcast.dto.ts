import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BroadcastAudience {
  ALL_USERS = 'ALL_USERS',
  VERIFIED_CUSTOMERS = 'VERIFIED_CUSTOMERS',
  MARKETING_OPT_IN = 'MARKETING_OPT_IN',
  CUSTOM_LIST = 'CUSTOM_LIST',
}

export class SendTestEmailDto {
  @ApiProperty({ description: 'Target email address for test' })
  @IsEmail()
  @IsNotEmpty()
  recipientEmail!: string;

  @ApiProperty({ description: 'Subject of the email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ description: 'HTML body of the email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  bodyHtml!: string;

  @ApiPropertyOptional({ description: 'Sample variables to replace during preview' })
  @IsOptional()
  sampleVariables?: Record<string, string>;
}

export class BroadcastCampaignDto {
  @ApiProperty({ description: 'Campaign subject line' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ description: 'HTML body of the campaign' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  bodyHtml!: string;

  @ApiProperty({
    enum: BroadcastAudience,
    description: 'Audience group to receive the broadcast',
  })
  @IsEnum(BroadcastAudience)
  @IsNotEmpty()
  recipientGroup!: BroadcastAudience;

  @ApiPropertyOptional({
    description: 'List of specific email addresses if recipientGroup is CUSTOM_LIST',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsEmail({}, { each: true })
  customEmails?: string[];

  @ApiPropertyOptional({ description: 'Optional campaign identifier or title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaignName?: string;

  @ApiPropertyOptional({ description: 'Originating template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;
}
