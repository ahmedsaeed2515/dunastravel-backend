import { Injectable, NotFoundException } from '@nestjs/common';
import { TourLandingPagesService } from '../tours/tour-landing-pages.service';

export interface PublicDestinationsQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  locale?: string;
}

@Injectable()
export class DestinationsService {
  constructor(private readonly landingPagesService: TourLandingPagesService) {}

  async findAllPublic(query: PublicDestinationsQueryDto) {
    return this.landingPagesService.findAllPublic({
      ...query,
      type: 'DESTINATION',
    });
  }

  async findOnePublic(slug: string, locale: string = 'en') {
    const destination = await this.landingPagesService.findOnePublic(
      slug,
      locale,
    );
    if (destination.type && destination.type !== 'DESTINATION') {
      throw new NotFoundException(`Destination with slug ${slug} not found`);
    }
    return destination;
  }
}
