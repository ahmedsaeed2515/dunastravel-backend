import { Injectable, NotFoundException } from '@nestjs/common';
import { TourLandingPagesService } from '../tours/tour-landing-pages.service';
import {
  PublicTourLandingPagesQueryDto,
  AdminTourLandingPagesQueryDto,
} from '../tours/dto/list-tour-landing-pages.dto';
import { CreateTourLandingPageDto } from '../tours/dto/create-tour-landing-page.dto';
import { UpdateTourLandingPageDto } from '../tours/dto/update-tour-landing-page.dto';
import {
  AttachToursDto,
  UpdateTourRelationDto,
  ReorderToursDto,
} from '../tours/dto/attach-tours.dto';
import { AuthenticatedUser } from '../../common/types';

@Injectable()
export class DestinationsService {
  constructor(private readonly landingPagesService: TourLandingPagesService) {}

  async findAllPublic(query: PublicTourLandingPagesQueryDto) {
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

  async findAllAdmin(query: AdminTourLandingPagesQueryDto) {
    return this.landingPagesService.findAllAdmin({
      ...query,
      type: 'DESTINATION',
    });
  }

  async findOneAdmin(idOrSlug: string) {
    const destination = await this.landingPagesService.findOneAdmin(idOrSlug);
    if (destination.type && destination.type !== 'DESTINATION') {
      throw new NotFoundException(`Destination ${idOrSlug} not found`);
    }
    return destination;
  }

  async createAdmin(dto: CreateTourLandingPageDto, actor: AuthenticatedUser) {
    return this.landingPagesService.createAdmin(
      {
        ...dto,
        type: 'DESTINATION',
      },
      actor,
    );
  }

  async updateAdmin(
    idOrSlug: string,
    dto: UpdateTourLandingPageDto,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.updateAdmin(idOrSlug, dto, actor);
  }

  async setStatusAdmin(
    idOrSlug: string,
    status: 'PUBLISHED' | 'DRAFT' | 'INACTIVE' | 'ARCHIVED',
    isActive: boolean | undefined,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.setStatusAdmin(
      idOrSlug,
      status,
      isActive,
      actor,
    );
  }

  async softDeleteAdmin(idOrSlug: string, actor: AuthenticatedUser) {
    return this.landingPagesService.softDeleteAdmin(idOrSlug, actor);
  }

  async reorderAdmin(
    items: { id: string; sortOrder: number }[],
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.reorderInterfacesAdmin(items, actor);
  }

  async attachTours(
    idOrSlug: string,
    dto: AttachToursDto,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.attachTours(idOrSlug, dto, actor);
  }

  async detachTour(
    idOrSlug: string,
    tourId: string,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.detachTour(idOrSlug, tourId, actor);
  }

  async updateTourRelation(
    idOrSlug: string,
    tourId: string,
    dto: UpdateTourRelationDto,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.updateTourRelation(
      idOrSlug,
      tourId,
      dto,
      actor,
    );
  }

  async reorderToursInDestination(
    idOrSlug: string,
    dto: ReorderToursDto,
    actor: AuthenticatedUser,
  ) {
    return this.landingPagesService.reorderToursInInterface(
      idOrSlug,
      dto,
      actor,
    );
  }
}
