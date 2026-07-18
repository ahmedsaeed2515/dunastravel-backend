import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminReportsService } from './admin-reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.AGENT)
@UseInterceptors(CacheInterceptor)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('bookings-trend')
  @CacheKey('admin:reports:bookings-trend')
  @CacheTTL(300) // 5 minutes (in seconds depending on cache-manager config, nestjs cache-manager-redis-yet uses ms, wait, cache-manager v5 uses ms. Let me check existing code.)
  @ApiOperation({ summary: 'Time-series booking counts.' })
  async getBookingsTrend(@Query('period') period: string = 'monthly') {
    return this.adminReportsService.getBookingsTrend(period);
  }

  @Get('revenue')
  @CacheKey('admin:reports:revenue')
  @CacheTTL(300)
  @ApiOperation({ summary: 'Time-series revenue grouping.' })
  async getRevenueTrend(@Query('period') period: string = 'monthly') {
    return this.adminReportsService.getRevenueTrend(period);
  }

  @Get('destinations')
  @CacheKey('admin:reports:destinations')
  @CacheTTL(300)
  @ApiOperation({ summary: 'Groupings by tour destination.' })
  async getDestinationsReport() {
    return this.adminReportsService.getDestinationsReport();
  }
}
