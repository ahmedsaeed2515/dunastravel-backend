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
import { UserRole } from '@prisma/client';
import { TourLandingPagesService } from './tour-landing-pages.service';
import { CreateTourLandingPageDto } from './dto/create-tour-landing-page.dto';
import { UpdateTourLandingPageDto } from './dto/update-tour-landing-page.dto';
import {
  AttachToursDto,
  UpdateTourRelationDto,
  ReorderToursDto,
} from './dto/attach-tours.dto';

@ApiTags('Admin Tour Landing Pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/tour-landing-pages')
export class TourLandingPagesAdminController {
  constructor(private readonly landingPagesService: TourLandingPagesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List all tour landing pages/interfaces with pagination and status filters',
  })
  async findAll(@Query() query: any) {
    return this.landingPagesService.findAllAdmin(query);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get full details of a single tour landing page' })
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.findOneAdmin(idOrSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tour landing page' })
  async create(@Body() dto: CreateTourLandingPageDto) {
    return this.landingPagesService.createAdmin(dto);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder landing page interfaces' })
  async reorderInterfaces(
    @Body() body: { items: { id: string; sortOrder: number }[] },
  ) {
    return this.landingPagesService.reorderInterfacesAdmin(body.items || []);
  }

  @Patch(':idOrSlug')
  @ApiOperation({
    summary: 'Update a tour landing page details, media, translations or SEO',
  })
  async update(
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: UpdateTourLandingPageDto,
  ) {
    return this.landingPagesService.updateAdmin(idOrSlug, dto);
  }

  @Patch(':idOrSlug/publish')
  @ApiOperation({ summary: 'Publish a tour landing page' })
  async publish(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.setStatusAdmin(idOrSlug, 'PUBLISHED', true);
  }

  @Patch(':idOrSlug/unpublish')
  @ApiOperation({ summary: 'Unpublish a tour landing page (set to DRAFT)' })
  async unpublish(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.setStatusAdmin(idOrSlug, 'DRAFT');
  }

  @Patch(':idOrSlug/activate')
  @ApiOperation({ summary: 'Activate a tour landing page' })
  async activate(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.setStatusAdmin(idOrSlug, 'PUBLISHED', true);
  }

  @Patch(':idOrSlug/deactivate')
  @ApiOperation({ summary: 'Deactivate a tour landing page' })
  async deactivate(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.setStatusAdmin(idOrSlug, 'INACTIVE', false);
  }

  @Patch(':idOrSlug/archive')
  @ApiOperation({ summary: 'Archive a tour landing page' })
  async archive(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.setStatusAdmin(idOrSlug, 'ARCHIVED', false);
  }

  @Delete(':idOrSlug')
  @ApiOperation({ summary: 'Safely soft delete a tour landing page' })
  async softDelete(@Param('idOrSlug') idOrSlug: string) {
    return this.landingPagesService.softDeleteAdmin(idOrSlug);
  }

  @Post(':idOrSlug/tours')
  @ApiOperation({
    summary: 'Attach existing tours to a landing page interface',
  })
  async attachTours(
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: AttachToursDto,
  ) {
    return this.landingPagesService.attachTours(idOrSlug, dto);
  }

  @Patch(':idOrSlug/tours/reorder')
  @ApiOperation({ summary: 'Reorder tours inside a landing page interface' })
  async reorderToursInInterface(
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: ReorderToursDto,
  ) {
    return this.landingPagesService.reorderToursInInterface(idOrSlug, dto);
  }

  @Patch(':idOrSlug/tours/:tourId')
  @ApiOperation({
    summary:
      'Update tour relation properties (sort order, featured, visible, custom badge)',
  })
  async updateTourRelation(
    @Param('idOrSlug') idOrSlug: string,
    @Param('tourId') tourId: string,
    @Body() dto: UpdateTourRelationDto,
  ) {
    return this.landingPagesService.updateTourRelation(idOrSlug, tourId, dto);
  }

  @Delete(':idOrSlug/tours/:tourId')
  @ApiOperation({
    summary:
      'Remove a tour from a landing page interface without deleting global tour record',
  })
  async detachTour(
    @Param('idOrSlug') idOrSlug: string,
    @Param('tourId') tourId: string,
  ) {
    return this.landingPagesService.detachTour(idOrSlug, tourId);
  }
}
