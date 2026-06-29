/* eslint-disable */
import { Controller, Get, Patch, Post, Delete, Query, Param, Body, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiParam, ApiBody, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { AddBookingNoteDto } from './dto/add-booking-note.dto';
import { AddBookingAttachmentDto } from './dto/add-booking-attachment.dto';
import { UpsertPassengersDto } from './dto/upsert-passengers.dto';
import { AssignBookingDto } from './dto/assign-booking.dto';
import { BulkUpdateBookingsDto } from './dto/bulk-update-bookings.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { ListContactSubmissionsQueryDto } from './dto/list-contact-submissions-query.dto';
import { ListNotificationLogsQueryDto } from './dto/list-notification-logs-query.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { UpdateContactSubmissionStatusDto } from './dto/update-contact-submission-status.dto';
import { ListAdminToursQueryDto } from './dto/list-admin-tours-query.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BulkUpdateToursDto } from './dto/bulk-update-tours.dto';

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

  @Get('bookings/export/csv')
  @ApiOperation({ summary: 'Export bookings to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportBookingsCsv(@Query() query: ListBookingsQueryDto, @Req() req: any) {
    return this.adminService.exportBookingsCsv(query, req.user.id);
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

  @Patch('bookings/bulk/update')
  @ApiOperation({ summary: 'Bulk update bookings.' })
  @ApiBody({ type: BulkUpdateBookingsDto })
  @ApiOkResponse({ description: 'Bookings updated successfully' })
  async bulkUpdateBookings(
    @Body() dto: BulkUpdateBookingsDto,
    @Req() req: any
  ) {
    return this.adminService.bulkUpdateBookings(dto, req.user.id);
  }

  @Patch('bookings/:referenceCode')
  @ApiOperation({ summary: 'Update general booking details.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateBookingDto })
  @ApiOkResponse({ description: 'Updated booking record' })
  async updateBooking(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateBookingDto,
    @Req() req: any
  ) {
    return this.adminService.updateBooking(referenceCode, dto, req.user.id);
  }

  @Patch('bookings/:referenceCode/status')
  @ApiOperation({ summary: 'Update the status of a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiOkResponse({ description: 'Updated booking status' })
  async updateBookingStatus(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpdateBookingStatusDto,
    @Req() req: any
  ) {
    return this.adminService.updateBookingStatus(referenceCode, dto, req.user.id);
  }

  @Patch('bookings/:referenceCode/passengers')
  @ApiOperation({ summary: 'Upsert passengers for a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpsertPassengersDto })
  @ApiOkResponse({ description: 'Passengers updated successfully' })
  async upsertPassengers(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: UpsertPassengersDto,
    @Req() req: any
  ) {
    return this.adminService.upsertPassengers(referenceCode, dto, req.user.id);
  }

  @Patch('bookings/:referenceCode/assign')
  @ApiOperation({ summary: 'Assign a booking to an admin.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AssignBookingDto })
  @ApiOkResponse({ description: 'Booking assigned successfully' })
  async assignBooking(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: AssignBookingDto,
    @Req() req: any
  ) {
    return this.adminService.assignBooking(referenceCode, dto, req.user.id);
  }

  @Post('bookings/:referenceCode/payments')
  @ApiOperation({ summary: 'Add a payment to a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AddPaymentDto })
  @ApiOkResponse({ description: 'Payment added successfully' })
  async addPayment(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: AddPaymentDto,
    @Req() req: any
  ) {
    return this.adminService.addPayment(referenceCode, dto, req.user.id);
  }

  @Post('bookings/:referenceCode/notes')
  @ApiOperation({ summary: 'Add an internal note to a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AddBookingNoteDto })
  @ApiOkResponse({ description: 'Note added successfully' })
  async addBookingNote(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: AddBookingNoteDto,
    @Req() req: any
  ) {
    return this.adminService.addBookingNote(referenceCode, dto, req.user.id);
  }

  @Post('bookings/:referenceCode/attachments')
  @ApiOperation({ summary: 'Link an attachment to a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AddBookingAttachmentDto })
  @ApiOkResponse({ description: 'Attachment linked successfully' })
  async addBookingAttachment(
    @Param('referenceCode') referenceCode: string,
    @Body() dto: AddBookingAttachmentDto,
    @Req() req: any
  ) {
    return this.adminService.addBookingAttachment(referenceCode, dto, req.user.id);
  }

  @Delete('bookings/:referenceCode')
  @ApiOperation({ summary: 'Soft delete a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Booking deleted successfully' })
  async softDeleteBooking(
    @Param('referenceCode') referenceCode: string,
    @Req() req: any
  ) {
    return this.adminService.softDeleteBooking(referenceCode, req.user.id);
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
  @UseInterceptors(CacheInterceptor)
  @CacheKey('admin:dashboard')
  @CacheTTL(60) // cache for 1 minute
  @ApiOperation({ summary: 'Retrieve aggregated CRM dashboard metrics.' })
  @ApiOkResponse({ description: 'Dashboard metrics object' })
  async getDashboardMetrics(@Req() req: any) {
    const adminUserId = req.user.id;
    return this.adminService.getDashboardMetrics(adminUserId);
  }

  @Get('tours')
  @ApiOperation({ summary: 'List all tours with advanced enterprise filtering and pagination.' })
  @ApiOkResponse({ description: 'Paginated list of tours' })
  async listTours(@Query() query: ListAdminToursQueryDto, @Req() req: any) {
    return this.adminService.listTours(query, req.user.id);
  }

  @Get('tours/stats')
  @ApiOperation({ summary: 'Get aggregated tour statistics and occupancy metrics.' })
  @ApiOkResponse({ description: 'Tour statistics object' })
  async getTourStats(@Req() req: any) {
    return this.adminService.getTourStats(req.user.id);
  }

  @Get('tours/export/csv')
  @ApiOperation({ summary: 'Export tours to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportToursCsv(@Query() query: ListAdminToursQueryDto, @Req() req: any) {
    return this.adminService.exportToursCsv(query, req.user.id);
  }

  @Get('tours/:slug')
  @ApiOperation({ summary: 'Get full details for a single tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiOkResponse({ description: 'Full tour record' })
  @ApiNotFoundResponse({ description: 'Tour not found' })
  async getTourBySlug(@Param('slug') slug: string, @Req() req: any) {
    return this.adminService.getTourBySlug(slug, req.user.id);
  }

  @Post('tours')
  @ApiOperation({ summary: 'Create a new tour (supports 10-step wizard data).' })
  @ApiBody({ type: CreateTourDto })
  @ApiOkResponse({ description: 'Tour created successfully' })
  async createTour(@Body() dto: CreateTourDto, @Req() req: any) {
    return this.adminService.createTour(dto, req.user.id);
  }

  @Patch('tours/bulk/update')
  @ApiOperation({ summary: 'Bulk update tours.' })
  @ApiBody({ type: BulkUpdateToursDto })
  @ApiOkResponse({ description: 'Tours updated successfully' })
  async bulkUpdateTours(@Body() dto: BulkUpdateToursDto, @Req() req: any) {
    return this.adminService.bulkUpdateTours(dto, req.user.id);
  }

  @Patch('tours/:slug')
  @ApiOperation({ summary: 'Update tour details.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiBody({ type: UpdateTourDto })
  @ApiOkResponse({ description: 'Updated tour record' })
  async updateTour(@Param('slug') slug: string, @Body() dto: UpdateTourDto, @Req() req: any) {
    return this.adminService.updateTour(slug, dto, req.user.id);
  }

  @Delete('tours/:slug')
  @ApiOperation({ summary: 'Soft delete a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiOkResponse({ description: 'Tour soft deleted successfully' })
  async softDeleteTour(@Param('slug') slug: string, @Req() req: any) {
    return this.adminService.softDeleteTour(slug, req.user.id);
  }
}
