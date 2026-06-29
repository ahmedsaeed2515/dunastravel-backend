/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PassengerDto } from './passenger.dto';
import { BillingInfoDto } from './billing-info.dto';

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: any) {
    if (!value) return false;
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return date > today;
  }

  defaultMessage() {
    return 'arrivalDate must be a future date';
  }
}

export function IsFutureDate() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: {},
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'passengerCountMatches', async: false })
export class PassengerCountMatchesConstraint implements ValidatorConstraintInterface {
  validate(passengerNames: PassengerDto[], args: ValidationArguments) {
    if (!Array.isArray(passengerNames)) return false;
    const obj = args.object as any;
    const adultsCount = obj.adults || 0;
    const childrenCount = obj.children || 0;
    const infantsCount = obj.infants || 0;

    const currentAdults = passengerNames.filter(
      (p) => p.passengerType === 'adult',
    ).length;
    const currentChildren = passengerNames.filter(
      (p) => p.passengerType === 'child',
    ).length;
    const currentInfants = passengerNames.filter(
      (p) => p.passengerType === 'infant',
    ).length;

    if (currentAdults === 0 && (currentChildren > 0 || currentInfants > 0)) {
      return false;
    }
    if (currentInfants > currentAdults * 2) {
      return false;
    }

    return (
      currentAdults === adultsCount &&
      currentChildren === childrenCount &&
      currentInfants <= infantsCount
    );
  }

  defaultMessage() {
    return 'passengerNames count must match adults and children counts, require at least one adult if children/infants present, and maximum 2 infants per adult';
  }
}

export function PassengerCountMatches() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: {},
      constraints: [],
      validator: PassengerCountMatchesConstraint,
    });
  };
}

export class CreateBookingDto {
  @ApiProperty({ description: 'UUID of the tour to book' })
  @IsUUID(4)
  @IsNotEmpty()
  tourId!: string;

  @ApiProperty({ example: '2027-03-15', description: 'Must be a future date' })
  @IsDateString()
  @IsFutureDate()
  arrivalDate!: string;

  @ApiPropertyOptional({ example: '2027-03-22' })
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @ApiProperty({ minimum: 1, maximum: 50, example: 2 })
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  adults!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  children: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  @Type(() => Number)
  infants: number = 0;

  @ApiPropertyOptional({ example: 'flight' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  transportChoice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  @PassengerCountMatches()
  passengerNames!: PassengerDto[];

  @ApiProperty({ type: BillingInfoDto })
  @ValidateNested()
  @Type(() => BillingInfoDto)
  billing!: BillingInfoDto;
}
