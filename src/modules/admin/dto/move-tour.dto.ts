import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Moves a tour between destination interfaces. The target is an actual
 * DESTINATION landing-page slug, not merely a display country label.
 */
export class MoveTourDto {
  @IsString()
  @MaxLength(150)
  destinationSlug!: string;

  @IsString()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
