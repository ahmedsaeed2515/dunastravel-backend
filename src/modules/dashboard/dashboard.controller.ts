import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Retrieve consolidated dashboard overview KPIs, trends, and feeds in a single request.',
  })
  @ApiOkResponse({ description: 'Consolidated dashboard overview object' })
  async getOverview(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getOverview(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Retrieve executive summary KPIs and comparison metrics.',
  })
  @ApiOkResponse({ description: 'Executive summary object' })
  async getExecutiveSummary(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getExecutiveSummary(query);
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Retrieve daily/weekly/monthly revenue trend.' })
  @ApiOkResponse({ description: 'Revenue trend array' })
  async getRevenueTrend(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getRevenueTrend(query);
  }

  @Get('bookings-trend')
  @ApiOperation({ summary: 'Retrieve bookings status trend over time.' })
  @ApiOkResponse({ description: 'Bookings trend array' })
  async getBookingsTrend(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getBookingsTrend(query);
  }

  @Get('tour-performance')
  @ApiOperation({ summary: 'Retrieve ranked tours performance metrics.' })
  @ApiOkResponse({ description: 'Tour performance object with rankings' })
  async getTourPerformance(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getTourPerformance(query);
  }

  @Get('top-destinations')
  @ApiOperation({ summary: 'Retrieve top destinations distribution and revenue.' })
  @ApiOkResponse({ description: 'Top destinations array' })
  async getTopDestinations(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getTopDestinations(query);
  }

  @Get('interface-performance')
  @ApiOperation({
    summary: 'Retrieve performance metrics for all landing page interfaces.',
  })
  @ApiOkResponse({ description: 'Interface performance array' })
  async getInterfacePerformance(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getInterfacePerformance(query);
  }

  @Get('conversion-funnel')
  @ApiOperation({
    summary: 'Retrieve website visitor to booking conversion funnel.',
  })
  @ApiOkResponse({ description: 'Funnel stages array' })
  async getConversionFunnel(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getConversionFunnel(query);
  }

  @Get('traffic')
  @ApiOperation({ summary: 'Retrieve traffic and device analytics.' })
  @ApiOkResponse({ description: 'Traffic analytics object' })
  async getTrafficAnalytics(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getTrafficAnalytics(query);
  }

  @Get('action-center')
  @ApiOperation({
    summary: 'Retrieve operational alerts requiring admin attention.',
  })
  @ApiOkResponse({ description: 'Action alerts array' })
  async getActionCenter(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getActionCenter(query);
  }

  @Get('recent-bookings')
  @ApiOperation({ summary: 'Retrieve recent bookings for operations table.' })
  @ApiOkResponse({ description: 'Recent bookings array' })
  async getRecentBookings() {
    return this.dashboardService.getRecentBookings();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Retrieve recent audit activity log feed.' })
  @ApiOkResponse({ description: 'Activity feed array' })
  async getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
