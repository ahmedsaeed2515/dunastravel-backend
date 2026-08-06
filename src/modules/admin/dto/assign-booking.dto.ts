import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignBookingDto {
  @ApiPropertyOptional({
    description:
      'Admin User ID to assign the booking to. Pass null to unassign.',
  })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string | null;
}
