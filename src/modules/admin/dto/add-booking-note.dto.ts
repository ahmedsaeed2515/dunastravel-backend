import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddBookingNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5_000)
  content!: string;
}
