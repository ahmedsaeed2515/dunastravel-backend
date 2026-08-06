import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderTourImageDto {
  @ApiProperty({ description: 'New sort order for the image' })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(10_000)
  sortOrder!: number;
}
