import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ContactSubmissionStatus } from '@prisma/client';

export class UpdateContactSubmissionStatusDto {
  @ApiProperty({
    description: 'The new status of the contact submission',
    enum: ContactSubmissionStatus,
    example: ContactSubmissionStatus.READ,
  })
  @IsEnum(ContactSubmissionStatus)
  status!: ContactSubmissionStatus;
}
