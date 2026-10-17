import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Moves a tour between destination interfaces and countries/cities/categories.
 */
export class MoveTourDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  destinationSlug?: string;

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
