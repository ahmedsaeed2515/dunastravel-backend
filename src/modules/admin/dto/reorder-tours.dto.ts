import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TourOrderItem {
  @ApiProperty({ description: 'Tour slug identifier' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'New display order position (0 = first)' })
  @IsInt()
  @Min(0)
  displayOrder!: number;
}

export class ReorderToursDto {
  @ApiProperty({
    type: [TourOrderItem],
    description: 'Array of { slug, displayOrder } pairs to bulk-update tour positions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourOrderItem)
  orders!: TourOrderItem[];
}
