import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { ParseUuidOrSlugPipe } from '../../common/pipes';
import { GetTourDetailQueryDto } from './dto';
import { ToursService } from './tours.service';

@ApiTags('Admin Tours')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiForbiddenResponse({ description: 'Requires an administrator role' })
@Controller('admin/tours')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminTourPreviewController {
  constructor(private readonly toursService: ToursService) {}

  @Get(':slug/preview')
  @ApiOperation({ summary: 'Preview a tour using the public presentation contract' })
  @ApiOkResponse({ description: 'Canonical tour presentation with preview visibility context' })
  @ApiNotFoundResponse({ description: 'Tour not found' })
  @ApiParam({ name: 'slug', type: String })
  async preview(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Query() query: GetTourDetailQueryDto,
  ) {
    return this.toursService.findPreviewBySlug(slug, query.lang);
  }
}
