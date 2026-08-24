import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateTourDto } from './create-tour.dto';

export class UpdateTourDto extends PartialType(CreateTourDto) {
  @ApiPropertyOptional({
    description:
      'The updatedAt value returned by the tour detail read. Rejects a stale editor save with HTTP 409.',
  })
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
