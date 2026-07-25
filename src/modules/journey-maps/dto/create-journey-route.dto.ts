import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JourneyPointDto {
  @ApiProperty({ description: 'Latitude coordinate (-90 to 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude coordinate (-180 to 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ description: 'Localized label or stop name' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Localized description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Day or sequence order index' })
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class CreateJourneyRouteDto {
  @ApiProperty({ description: 'Route name or title' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ type: [JourneyPointDto], description: 'List of waypoints' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JourneyPointDto)
  points!: JourneyPointDto[];

  @ApiPropertyOptional({ description: 'Associated Tour UUID' })
  @IsOptional()
  @IsString()
  tourId?: string;
}
