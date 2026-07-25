import { IsString, IsNotEmpty, MaxLength, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
}
