/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEmail,
  Matches,
  IsIn,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsNumber,
  Length,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'IsEndDateAfterStart', async: false })
class IsEndDateAfterStartConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const obj = args.object as any;
    if (!obj.startDate || !value) return true;
    return new Date(value as string) >= new Date(obj.startDate);
  }

  defaultMessage() {
    return 'endDate must not be before startDate';
  }
}

export class CreateInquiryDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email!: string;

  @ApiProperty({ example: '+1 (555) 123-4567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[\d\s\-+()]+$/, {
    message:
      'phone must contain only numbers, spaces, and valid symbols (+, -, (, ))',
  })
  phone!: string;

  @ApiProperty({ example: 'en', enum: ['en', 'es', 'fr', 'de', 'it', 'ar'] })
  @IsIn(['en', 'es', 'fr', 'de', 'it', 'ar'])
  @IsNotEmpty()
  preferredLanguage!: string;

  @ApiProperty({ type: [String], example: ['Cairo', 'Luxor'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  destinations!: string[];

  @ApiPropertyOptional({ example: '2027-10-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-10-15' })
  @IsOptional()
  @IsDateString()
  @Validate(IsEndDateAfterStartConstraint)
  endDate?: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  adults!: number;

  @ApiPropertyOptional({ example: 0, default: 0, minimum: 0, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  children: number = 0;

  @ApiPropertyOptional({ example: 5000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  budgetAmount?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @ValidateIf(
    (o: any) => o.budgetAmount !== undefined && o.budgetAmount !== null,
  )
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  budgetCurrency?: string;

  @ApiPropertyOptional({
    example: 'We want a family friendly trip with lots of history.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;
}
