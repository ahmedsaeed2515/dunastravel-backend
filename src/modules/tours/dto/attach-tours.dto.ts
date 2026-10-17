import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttachToursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  tourIds!: string[];

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsObject()
  @IsOptional()
  customBadge?: Record<string, string>;
}

export class UpdateTourRelationDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsObject()
  @IsOptional()
  customBadge?: Record<string, string>;
}

export class ReorderTourItemDto {
  @IsOptional()
  @IsUUID('4')
  tourId?: string;

  @IsOptional()
  slug?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;
}

export class ReorderToursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderTourItemDto)
  items!: ReorderTourItemDto[];
}
