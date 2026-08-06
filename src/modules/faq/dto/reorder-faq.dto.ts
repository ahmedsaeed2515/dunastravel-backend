import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
  IsInt,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FaqReorderItemDto {
  @ApiProperty()
  @IsUUID('4')
  id!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;
}

export class ReorderFaqDto {
  @ApiProperty({ type: [FaqReorderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => FaqReorderItemDto)
  items!: FaqReorderItemDto[];
}
