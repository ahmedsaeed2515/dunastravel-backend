/* eslint-disable */
import { Controller, Get, Patch, Query, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiParam, ApiBody, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { ListContactSubmissionsQueryDto } from './dto/list-contact-submissions-query.dto';
import { ListNotificationLogsQueryDto } from './dto/list-notification-logs-query.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { UpdateContactSubmissionStatusDto } from './dto/update-contact-submission-status.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiForbiddenResponse({ description: 'Forbidden: Requires ADMIN role' })
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of bookings' })
  async listBookings(@Query() query: ListBookingsQueryDto, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.listBookings(query, adminUserId);
  }

  @Get('bookings/:referenceCode')
  @ApiOperation({ summary: 'Get full detail for a single booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Full booking record' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  async getBookingByReferenceCode(@Param('referenceCode') referenceCode: string, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.getBookingByReferenceCode(referenceCode, adminUserId);
  }

  @Get('inquiries')
  @ApiOperation({ summary: 'List all tailor-made inquiries with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of inquiries' })
  async listInquiries(@Query() query: ListInquiriesQueryDto, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.listInquiries(query, adminUserId);
  }

  @Get('inquiries/:referenceCode')
  @ApiOperation({ summary: 'Get full detail for a single tailor-made inquiry.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Full inquiry record' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  async getInquiryByReferenceCode(@Param('referenceCode') referenceCode: string, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.getInquiryByReferenceCode(referenceCode, adminUserId);
  }

  @Patch('inquiries/:referenceCode/status')
  @ApiOperation({ summary: 'Update the status of a tailor-made inquiry.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateInquiryStatusDto })
  @ApiOkResponse({ description: 'Updated inquiry record' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  async updateInquiryStatus(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateInquiryStatusDto,
    @Req() req: any
  ) {
    const adminUserId = req.user.id;
    return this.adminService.updateInquiryStatus(referenceCode, dto, adminUserId);
  }

  @Get('contact-submissions')
  @ApiOperation({ summary: 'List all contact submissions with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of contact submissions' })
  async listContactSubmissions(@Query() query: ListContactSubmissionsQueryDto, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.listContactSubmissions(query, adminUserId);
  }

  @Get('contact-submissions/:referenceCode')
  @ApiOperation({ summary: 'Get full detail for a single contact submission.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Full contact submission record' })
  @ApiNotFoundResponse({ description: 'Contact submission not found' })
  async getContactSubmissionByReferenceCode(@Param('referenceCode') referenceCode: string, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.getContactSubmissionByReferenceCode(referenceCode, adminUserId);
  }

  @Patch('contact-submissions/:referenceCode/status')
  @ApiOperation({ summary: 'Update the status of a contact submission.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateContactSubmissionStatusDto })
  @ApiOkResponse({ description: 'Updated contact submission record' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiNotFoundResponse({ description: 'Contact submission not found' })
  async updateContactSubmissionStatus(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateContactSubmissionStatusDto,
    @Req() req: any
  ) {
    const adminUserId = req.user.id;
    return this.adminService.updateContactSubmissionStatus(referenceCode, dto, adminUserId);
  }

  @Get('notification-logs')
  @ApiOperation({ summary: 'List notification delivery logs with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of notification logs' })
  async listNotificationLogs(@Query() query: ListNotificationLogsQueryDto, @Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.listNotificationLogs(query, adminUserId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Retrieve aggregated CRM dashboard metrics.' })
  @ApiOkResponse({ description: 'Dashboard metrics object' })
  async getDashboardMetrics(@Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.getDashboardMetrics(adminUserId);
  }
}
