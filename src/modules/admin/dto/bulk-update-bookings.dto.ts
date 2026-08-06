import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class BulkUpdateBookingsDto {
  @ApiProperty({ description: 'Array of booking reference codes' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^(?:BKG|TMB)-[A-Z0-9]{6}$/, { each: true })
  referenceCodes!: string[];

  @ApiPropertyOptional({ description: 'New assignee ID' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'New priority' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  priority?: string;
}
