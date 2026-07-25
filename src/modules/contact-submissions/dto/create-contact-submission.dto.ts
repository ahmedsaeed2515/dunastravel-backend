import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  IsOptional,
  Matches,
  MinLength,
  IsIn,
} from 'class-validator';

export class CreateContactSubmissionDto {
  @ApiProperty({
    description: "The submitter's first name",
    example: 'John',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName!: string;

  @ApiProperty({
    description: "The submitter's last name",
    example: 'Doe',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName!: string;

  @ApiProperty({
    description: "The submitter's email address",
    example: 'john.doe@example.com',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiPropertyOptional({
    description: "The submitter's phone number",
    example: '+1234567890',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\d\s\-\+\(\)]+$/, {
    message: 'phone must contain only valid formatting characters',
  })
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @ApiProperty({
    description: 'The subject of the inquiry',
    example: 'Inquiry regarding custom tour',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subject!: string;

  @ApiProperty({
    description: 'The full message content',
    example: 'I would like to know if you organize customized tours in Europe.',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message!: string;

  @ApiPropertyOptional({
    description: 'Preferred language locale for communications (e.g. en, es)',
    example: 'en',
    enum: ['en', 'es', 'fr', 'de', 'ar', 'pt'],
  })
  @IsOptional()
  @IsIn(['en', 'es', 'fr', 'de', 'ar', 'pt'])
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  locale?: string = 'en';
}
