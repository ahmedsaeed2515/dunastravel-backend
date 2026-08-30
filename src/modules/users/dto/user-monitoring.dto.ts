import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SuspendUserDto {
  @ApiProperty({ description: 'Reason for suspending the user', example: 'Suspicious activity detected' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class AddUserMonitoringNoteDto {
  @ApiProperty({ description: 'Note content', example: 'Customer called regarding VIP custom tour.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ description: 'Note type', default: 'MONITORING', example: 'MONITORING' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  noteType?: string = 'MONITORING';

  @ApiPropertyOptional({ description: 'Whether the note is pinned', default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean = false;
}

export class ListActivityStreamQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by category (AUTH, BOOKING, INQUIRY, REVIEW, ADMIN, ALL)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by target User ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;
}
