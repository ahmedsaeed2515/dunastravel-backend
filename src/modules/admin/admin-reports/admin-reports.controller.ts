import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminReportsService } from './admin-reports.service';
import { AdminReportPeriodQueryDto } from './admin-report-query.dto';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseInterceptors(CacheInterceptor)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('bookings-trend')
  @CacheTTL(300_000)
  @ApiOperation({ summary: 'Time-series booking counts.' })
  async getBookingsTrend(@Query() query: AdminReportPeriodQueryDto) {
    return this.adminReportsService.getBookingsTrend(query.period);
  }

  @Get('revenue')
  @CacheTTL(300_000)
  @ApiOperation({ summary: 'Time-series revenue grouping.' })
  async getRevenueTrend(@Query() query: AdminReportPeriodQueryDto) {
    return this.adminReportsService.getRevenueTrend(query.period);
  }

  @Get('destinations')
  @CacheTTL(300_000)
  @ApiOperation({ summary: 'Groupings by tour destination.' })
  async getDestinationsReport() {
    return this.adminReportsService.getDestinationsReport();
  }
}
