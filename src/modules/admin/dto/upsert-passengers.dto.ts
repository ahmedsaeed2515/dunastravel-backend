import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PassengerDto {
  @ApiPropertyOptional({ description: 'ID if updating an existing passenger' })
  @IsOptional()
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
  id?: string;

  @ApiProperty({ description: 'Type: adult, child, infant' })
  @IsIn(['ADULT', 'CHILD', 'INFANT'])
  passengerType!: string;

  @ApiProperty({ description: 'Full name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ description: 'Passport number' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]{2,29}$/)
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
  @MaxLength(100)
  nationality?: string;
}

export class UpsertPassengersDto {
  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];
}
