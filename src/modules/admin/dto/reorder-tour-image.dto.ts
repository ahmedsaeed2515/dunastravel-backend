import { IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderTourImageDto {
  @ApiProperty({ description: 'New sort order for the image' })
  @IsInt()
  @IsNotEmpty()
  sortOrder!: number;
}
