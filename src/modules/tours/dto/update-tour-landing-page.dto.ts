import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional } from 'class-validator';
import { CreateTourLandingPageDto } from './create-tour-landing-page.dto';

export class UpdateTourLandingPageDto extends PartialType(
  CreateTourLandingPageDto,
) {
  /** Prevent a stale editor from silently overwriting another admin's work. */
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
