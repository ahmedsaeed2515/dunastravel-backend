import { PartialType } from '@nestjs/mapped-types';
import { CreateTourLandingPageDto } from './create-tour-landing-page.dto';

export class UpdateTourLandingPageDto extends PartialType(CreateTourLandingPageDto) {}
