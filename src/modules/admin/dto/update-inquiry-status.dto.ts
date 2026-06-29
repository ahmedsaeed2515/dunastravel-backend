import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TailorMadeInquiryStatus } from '@prisma/client';

export class UpdateInquiryStatusDto {
  @ApiProperty({
    description: 'The new status of the inquiry',
    enum: TailorMadeInquiryStatus,
    example: TailorMadeInquiryStatus.IN_PROGRESS,
  })
  @IsEnum(TailorMadeInquiryStatus)
  status!: TailorMadeInquiryStatus;
}
