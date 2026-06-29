import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInquiryStatusDto {
  @ApiProperty({ enum: ['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'] })
  @IsEnum(['NEWLY_RECEIVED', 'IN_PROGRESS', 'CLOSED'])
  @IsNotEmpty()
  status!: string;
}
