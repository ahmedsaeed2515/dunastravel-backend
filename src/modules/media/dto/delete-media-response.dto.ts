import { ApiProperty } from '@nestjs/swagger';

export class DeleteMediaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  deletedAt!: Date;

  @ApiProperty()
  providerDeleteFailed!: boolean;
}
