import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class FaqReorderItemDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;
}

export class ReorderFaqDto {
  @ApiProperty({ type: [FaqReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqReorderItemDto)
  items!: FaqReorderItemDto[];
}
