import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PassengerDto {
  @ApiPropertyOptional({ description: 'ID if updating an existing passenger' })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Type: adult, child, infant' })
  @IsString()
  @IsNotEmpty()
  passengerType!: string;

  @ApiProperty({ description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional({ description: 'Passport number' })
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiPropertyOptional({ description: 'Passport expiration date' })
  @IsDateString()
  @IsOptional()
  passportExpiry?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Nationality' })
  @IsString()
  @IsOptional()
  nationality?: string;
}

export class UpsertPassengersDto {
  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];
}
