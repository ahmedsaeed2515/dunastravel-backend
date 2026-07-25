import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAgenciesService } from './admin-agencies.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CompanyStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('admin-agencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/agencies')
export class AdminAgenciesController {
  constructor(private readonly service: AdminAgenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all agencies' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(Number(page), Number(limit), status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agency' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update agency status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CompanyStatus,
  ) {
    return this.service.updateStatus(id, status);
  }

  @Patch(':id/tier')
  @ApiOperation({ summary: 'Update agency tier and commission rate' })
  async updateTier(
    @Param('id') id: string,
    @Body('tier') tier: string,
    @Body('commissionRate') commissionRate: number,
  ) {
    return this.service.updateTier(id, tier, commissionRate);
  }
}
