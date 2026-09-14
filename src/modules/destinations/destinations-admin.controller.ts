import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UserRole } from '@prisma/client';
import { DestinationsService } from './destinations.service';
import { CreateTourLandingPageDto } from '../tours/dto/create-tour-landing-page.dto';
import { UpdateTourLandingPageDto } from '../tours/dto/update-tour-landing-page.dto';
import {
  AttachToursDto,
  UpdateTourRelationDto,
  ReorderToursDto,
} from '../tours/dto/attach-tours.dto';
import { AdminTourLandingPagesQueryDto } from '../tours/dto/list-tour-landing-pages.dto';
import { ReorderLandingPagesDto } from '../tours/dto/reorder-landing-pages.dto';
import { ParseUuidOrSlugPipe } from '../../common/pipes';

@ApiTags('Admin Destinations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/destinations')
export class DestinationsAdminController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all destinations with pagination, tour counts and status filters',
  })
  async findAll(@Query() query: AdminTourLandingPagesQueryDto) {
    return this.destinationsService.findAllAdmin(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({
    summary: 'Get full details of a single destination with attached tours',
  })
  async findOne(@Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string) {
    return this.destinationsService.findOneAdmin(idOrSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new destination' })
  async create(
    @Body() dto: CreateTourLandingPageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.createAdmin(dto, actor);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder destinations' })
  async reorder(
    @Body() body: ReorderLandingPagesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.reorderAdmin(body.items, actor);
  }

  @Patch(':idOrSlug')
  @ApiOperation({
    summary: 'Update destination details, media, translations or SEO',
  })
  async update(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Body() dto: UpdateTourLandingPageDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.updateAdmin(idOrSlug, dto, actor);
  }

  @Patch(':idOrSlug/publish')
  @ApiOperation({ summary: 'Publish a destination' })
  async publish(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.setStatusAdmin(
      idOrSlug,
      'PUBLISHED',
      true,
      actor,
    );
  }

  @Patch(':idOrSlug/unpublish')
  @ApiOperation({ summary: 'Unpublish a destination (set to DRAFT)' })
  async unpublish(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.setStatusAdmin(
      idOrSlug,
      'DRAFT',
      undefined,
      actor,
    );
  }

  @Patch(':idOrSlug/activate')
  @ApiOperation({ summary: 'Activate a destination' })
  async activate(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.setStatusAdmin(
      idOrSlug,
      'PUBLISHED',
      true,
      actor,
    );
  }

  @Patch(':idOrSlug/deactivate')
  @ApiOperation({ summary: 'Deactivate a destination' })
  async deactivate(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.setStatusAdmin(
      idOrSlug,
      'INACTIVE',
      false,
      actor,
    );
  }

  @Patch(':idOrSlug/archive')
  @ApiOperation({ summary: 'Archive a destination' })
  async archive(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.setStatusAdmin(
      idOrSlug,
      'ARCHIVED',
      false,
      actor,
    );
  }

  @Delete(':idOrSlug')
  @ApiOperation({ summary: 'Safely soft delete a destination' })
  async softDelete(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.softDeleteAdmin(idOrSlug, actor);
  }

  @Post(':idOrSlug/tours')
  @ApiOperation({ summary: 'Attach tours to a destination' })
  async attachTours(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Body() dto: AttachToursDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.attachTours(idOrSlug, dto, actor);
  }

  @Patch(':idOrSlug/tours/reorder')
  @ApiOperation({ summary: 'Reorder tours inside a destination' })
  async reorderTours(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Body() dto: ReorderToursDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.reorderToursInDestination(
      idOrSlug,
      dto,
      actor,
    );
  }

  @Patch(':idOrSlug/tours/:tourId')
  @ApiOperation({ summary: 'Update tour relation properties in destination' })
  async updateTourRelation(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Param('tourId') tourId: string,
    @Body() dto: UpdateTourRelationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.updateTourRelation(
      idOrSlug,
      tourId,
      dto,
      actor,
    );
  }

  @Delete(':idOrSlug/tours/:tourId')
  @ApiOperation({ summary: 'Remove a tour from a destination' })
  async detachTour(
    @Param('idOrSlug', ParseUuidOrSlugPipe) idOrSlug: string,
    @Param('tourId') tourId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.destinationsService.detachTour(idOrSlug, tourId, actor);
  }
}
