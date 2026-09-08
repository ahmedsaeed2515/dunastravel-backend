import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NotificationDeliveryStatus,
  NotificationType,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class NotificationDeliveryLogQueryFilters {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(NotificationDeliveryStatus)
  status?: NotificationDeliveryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(NotificationType)
  notificationType?: NotificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(254)
  recipientEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
