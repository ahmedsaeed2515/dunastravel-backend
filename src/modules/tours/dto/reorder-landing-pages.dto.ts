import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class ReorderLandingPageItemDto {
  @IsUUID('4')
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;
}

export class ReorderLandingPagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderLandingPageItemDto)
  items!: ReorderLandingPageItemDto[];
}
