import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
} from 'class-validator';

export class AttachToursDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
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
  @IsInt()
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

export class ReorderToursDto {
  @IsArray()
  items!: { tourId: string; sortOrder: number }[];
}
