import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
} from '@prisma/client';

export class ListInAppNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(InAppNotificationCategory)
  category?: InAppNotificationCategory;

  @IsOptional()
  @IsString()
  isRead?: string; // 'true' | 'false'
}

export class CreateInAppNotificationDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(InAppNotificationCategory)
  category?: InAppNotificationCategory;

  @IsOptional()
  @IsEnum(InAppNotificationPriority)
  priority?: InAppNotificationPriority;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  targetApp?: string = 'ADMIN';

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  deepLink?: string;

  @IsOptional()
  metadata?: any;
}
