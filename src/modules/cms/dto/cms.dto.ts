import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CmsBlockStatus } from '@prisma/client';

export class UpsertCmsBlockDto {
  @IsDefined()
  content!: unknown;

  @IsOptional()
  @IsEnum(CmsBlockStatus)
  status?: CmsBlockStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class CmsCatalogItemDto {
  @IsDefined()
  @IsObject()
  item!: Record<string, unknown>;
}

export class ListCmsBlocksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class PublicCmsBlockQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['en', 'ar', 'es', 'pt', 'it'])
  lang?: 'en' | 'ar' | 'es' | 'pt' | 'it';
}
