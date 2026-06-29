import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddBookingAttachmentDto {
  @ApiProperty({
    description: 'The ID of the MediaAsset uploaded via the media module',
  })
  @IsString()
  @IsNotEmpty()
  mediaAssetId!: string;
}
