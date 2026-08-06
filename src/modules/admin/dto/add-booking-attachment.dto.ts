import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddBookingAttachmentDto {
  @ApiProperty({
    description: 'The ID of the MediaAsset uploaded via the media module',
  })
  @IsUUID('4')
  mediaAssetId!: string;
}
