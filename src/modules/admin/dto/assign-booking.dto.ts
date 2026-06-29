import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignBookingDto {
  @ApiPropertyOptional({
    description:
      'Admin User ID to assign the booking to. Pass null to unassign.',
  })
  @IsString()
  @IsOptional()
  assigneeId?: string | null;
}
