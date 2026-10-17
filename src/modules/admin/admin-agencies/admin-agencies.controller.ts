import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminAgenciesService } from './admin-agencies.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../common/types';
import {
  AdminAgencyQueryDto,
  UpdateAgencyStatusDto,
  UpdateAgencyTierDto,
} from './dto/admin-agency.dto';

@ApiTags('admin-agencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/agencies')
export class AdminAgenciesController {
  constructor(private readonly service: AdminAgenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all agencies' })
  async findAll(@Query() query: AdminAgencyQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agency' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update agency status' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto.status, actor.id);
  }

  @Patch(':id/tier')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update agency tier and commission rate' })
  async updateTier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyTierDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.updateTier(id, dto.tier, dto.commissionRate, actor.id);
  }
}
