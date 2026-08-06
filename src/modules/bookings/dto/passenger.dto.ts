import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsOptional,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export function IsFutureDateString(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDateString',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value || typeof value !== 'string') return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const date = new Date(value);
          if (isNaN(date.getTime())) return false;
          const iso = date.toISOString().split('T')[0];
          if (iso !== value) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return date > today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid future calendar date in YYYY-MM-DD format`;
        },
      },
    });
  };
}

export function IsPastDateString(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPastDateString',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value || typeof value !== 'string') return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const date = new Date(value);
          if (isNaN(date.getTime())) return false;
          const iso = date.toISOString().split('T')[0];
          if (iso !== value) return false;
          const today = new Date();
          return date < today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid past calendar date in YYYY-MM-DD format`;
        },
      },
    });
  };
}

export class PassengerDto {
  @ApiProperty({ enum: ['adult', 'child', 'infant'] })
  @IsIn(['adult', 'child', 'infant'])
  passengerType!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  fullName!: string;

  @ApiPropertyOptional({ example: 'A12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  passportNumber?: string;

  @ApiPropertyOptional({
    example: '2030-05-15',
    description: 'Passport Expiry (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @IsFutureDateString({
    message: 'passportExpiry must be a valid calendar date in the future (YYYY-MM-DD)',
  })
  passportExpiry?: string;

  @ApiPropertyOptional({
    example: '1990-01-01',
    description: 'Date of Birth (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @IsPastDateString({
    message: 'dateOfBirth must be a valid calendar date in the past (YYYY-MM-DD)',
  })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'ES' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;
}
