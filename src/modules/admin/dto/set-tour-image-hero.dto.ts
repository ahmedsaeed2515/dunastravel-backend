import { ApiProperty } from '@nestjs/swagger';

/** Marker DTO retained for generated OpenAPI; the selected image is identified by the route. */
export class SetTourImageHeroDto {
  @ApiProperty({
    description: 'Marks the route image as the one hero image for its tour.',
    example: true,
  })
  readonly isHero = true;
}
