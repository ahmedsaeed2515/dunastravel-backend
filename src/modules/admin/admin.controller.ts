import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AddBookingNoteDto } from './dto/add-booking-note.dto';
import { AddBookingAttachmentDto } from './dto/add-booking-attachment.dto';
import { UpsertPassengersDto } from './dto/upsert-passengers.dto';
import { AssignBookingDto } from './dto/assign-booking.dto';
import { BulkUpdateBookingsDto } from './dto/bulk-update-bookings.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { ListNotificationLogsQueryDto } from './dto/list-notification-logs-query.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { ListAdminToursQueryDto } from './dto/list-admin-tours-query.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BulkUpdateToursDto } from './dto/bulk-update-tours.dto';
import { ReorderToursDto } from './dto/reorder-tours.dto';
import { AddTourImageDto } from './dto/add-tour-image.dto';
import { ReorderTourImageDto } from './dto/reorder-tour-image.dto';
import { SetTourImageHeroDto } from './dto/set-tour-image-hero.dto';
import { AddTourItineraryDto } from './dto/add-tour-itinerary.dto';
import { UpdateTourItineraryDto } from './dto/update-tour-itinerary.dto';
import { AdminCreateBookingDto } from './dto/admin-create-booking.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { BookingsService } from '../bookings/bookings.service';
import {
  ParseBookingRefPipe,
  ParseInquiryRefPipe,
  ParseUuidOrSlugPipe,
} from '../../common/pipes';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized' })
@ApiForbiddenResponse({ description: 'Forbidden: Requires ADMIN role' })
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings with pagination and filtering.' })
  @ApiOkResponse({ description: 'Paginated list of bookings' })
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async listBookings(
    @Query() query: ListBookingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.AGENT) {
      query.assigneeId = user.id;
    }
    return this.adminService.listBookings(query, user.id);
  }

  @Get('bookings/export/csv')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export bookings to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportBookingsCsv(
    @Query() query: ListBookingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.exportBookingsCsv(query, user.id);
  }

  @Get('bookings/:referenceCode')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get full detail for a single booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Full booking record' })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  async getBookingByReferenceCode(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAgent = user.role === UserRole.AGENT;
    return this.adminService.getBookingByReferenceCode(
      referenceCode,
      user.id,
      isAgent,
    );
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a manual booking (Admin Override)' })
  @ApiBody({ type: AdminCreateBookingDto })
  @ApiOkResponse({ description: 'Created booking record' })
  async createManualBooking(
    @Body() dto: AdminCreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for manual bookings',
      );
    }
    const passengerNamesMap: Record<string, string> = {};
    if (dto.passengers && dto.passengers.length > 0) {
      dto.passengers.forEach((p, idx) => {
        const key = `${p.passengerType.toLowerCase()}_${idx}`;
        passengerNamesMap[key] = p.fullName;
      });
    }

    const bookingDto: CreateBookingDto = {
      type: 'booking',
      tourId: dto.tourId,
      availabilityId: dto.availabilityId,
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      adults:
        dto.adults ??
        (dto.passengers?.filter((p) => p.passengerType === 'ADULT').length ||
          1),
      children:
        dto.children ??
        (dto.passengers?.filter((p) => p.passengerType === 'CHILD').length ||
          0),
      infants:
        dto.infants ??
        (dto.passengers?.filter((p) => p.passengerType === 'INFANT').length ||
          0),
      passengerNames:
        Object.keys(passengerNamesMap).length > 0
          ? passengerNamesMap
          : undefined,
      invoiceType: dto.invoiceType,
      companyName: dto.companyName,
      taxId: dto.taxId,
      address: dto.address,
      city: dto.city,
      country: dto.country,
      promoCode: dto.promoCode,
      notes: dto.notes,
    };
    if (dto.userId) {
      await this.adminService.assertActiveBookingCustomer(
        dto.userId,
        dto.email,
      );
    }
    const result = await this.bookingsService.createBooking(
      bookingDto,
      dto.userId,
      idempotencyKey,
    );
    await this.adminService.recordManualBookingCreation(
      result.id,
      user.id,
      user.role,
      dto.userId,
    );
    return result;
  }

  @Post('bookings/:referenceCode/restore')
  @ApiOperation({ summary: 'Restore a cancelled or archived booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Restored booking record' })
  async restoreBooking(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.restoreBooking(referenceCode, user.id);
  }

  @Post('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: SuspendUserDto })
  @ApiOkResponse({ description: 'User suspended' })
  @Roles(UserRole.SUPER_ADMIN)
  async suspendUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.suspendUser(userId, dto.reason, user.id);
  }

  @Post('users/:id/activate')
  @ApiOperation({ summary: 'Activate a suspended user account.' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOkResponse({ description: 'User activated' })
  @Roles(UserRole.SUPER_ADMIN)
  async activateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.activateUser(userId, user.id);
  }

  @Patch('bookings/bulk/update')
  @ApiOperation({ summary: 'Bulk update bookings.' })
  @ApiBody({ type: BulkUpdateBookingsDto })
  @ApiOkResponse({ description: 'Bookings updated successfully' })
  async bulkUpdateBookings(
    @Body() dto: BulkUpdateBookingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.bulkUpdateBookings(dto, user.id);
  }

  @Patch('bookings/:referenceCode')
  @ApiOperation({ summary: 'Update general booking details.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateBookingDto })
  @ApiOkResponse({ description: 'Updated booking record' })
  async updateBooking(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateBooking(referenceCode, dto, user.id);
  }

  @Patch('bookings/:referenceCode/status')
  @ApiOperation({ summary: 'Update the status of a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiOkResponse({ description: 'Updated booking status' })
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async updateBookingStatus(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAgent = user.role === UserRole.AGENT;
    return this.adminService.updateBookingStatus(
      referenceCode,
      dto,
      user.id,
      isAgent,
    );
  }

  @Patch('bookings/:referenceCode/passengers')
  @ApiOperation({ summary: 'Upsert passengers for a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpsertPassengersDto })
  @ApiOkResponse({ description: 'Passengers updated successfully' })
  async upsertPassengers(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: UpsertPassengersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.upsertPassengers(referenceCode, dto, user.id);
  }

  @Patch('bookings/:referenceCode/assign')
  @ApiOperation({ summary: 'Assign a booking to an admin.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AssignBookingDto })
  @ApiOkResponse({ description: 'Booking assigned successfully' })
  async assignBooking(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: AssignBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.assignBooking(referenceCode, dto, user.id);
  }

  @Post('bookings/:referenceCode/notes')
  @ApiOperation({ summary: 'Add an internal note to a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AddBookingNoteDto })
  @ApiOkResponse({ description: 'Note added successfully' })
  async addBookingNote(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: AddBookingNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.addBookingNote(referenceCode, dto, user.id);
  }

  @Post('bookings/:referenceCode/attachments')
  @ApiOperation({ summary: 'Link an attachment to a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: AddBookingAttachmentDto })
  @ApiOkResponse({ description: 'Attachment linked successfully' })
  async addBookingAttachment(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @Body() dto: AddBookingAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.addBookingAttachment(referenceCode, dto, user.id);
  }

  @Delete('bookings/:referenceCode')
  @ApiOperation({ summary: 'Soft delete a booking.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Booking deleted successfully' })
  async softDeleteBooking(
    @Param('referenceCode', ParseBookingRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.softDeleteBooking(referenceCode, user.id);
  }

  @Get('inquiries')
  @ApiOperation({
    summary: 'List all tailor-made inquiries with pagination and filtering.',
  })
  @ApiOkResponse({ description: 'Paginated list of inquiries' })
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async listInquiries(
    @Query() query: ListInquiriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.AGENT) {
      query.assigneeId = user.id;
    }
    return this.adminService.listInquiries(query, user.id);
  }

  @Get('inquiries/:referenceCode')
  @ApiOperation({
    summary: 'Get full detail for a single tailor-made inquiry.',
  })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiOkResponse({ description: 'Full inquiry record' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async getInquiryByReferenceCode(
    @Param('referenceCode', ParseInquiryRefPipe) referenceCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAgent = user.role === UserRole.AGENT;
    return this.adminService.getInquiryByReferenceCode(
      referenceCode,
      user.id,
      isAgent,
    );
  }

  @Patch('inquiries/:referenceCode')
  @ApiOperation({ summary: 'Update a tailor-made inquiry.' })
  @ApiParam({ name: 'referenceCode', type: 'string' })
  @ApiBody({ type: UpdateInquiryDto })
  @ApiOkResponse({ description: 'Updated inquiry record' })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiNotFoundResponse({ description: 'Inquiry not found' })
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  async updateInquiry(
    @Param('referenceCode', ParseInquiryRefPipe) referenceCode: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isAgent = user.role === UserRole.AGENT;
    return this.adminService.updateInquiry(
      referenceCode,
      dto,
      user.id,
      isAgent,
    );
  }

  @Get('notification-logs')
  @ApiOperation({
    summary: 'List notification delivery logs with pagination and filtering.',
  })
  @ApiOkResponse({ description: 'Paginated list of notification logs' })
  async listNotificationLogs(
    @Query() query: ListNotificationLogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.listNotificationLogs(query, user.id);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Retrieve aggregated CRM dashboard metrics.' })
  @ApiOkResponse({ description: 'Dashboard metrics object' })
  async getDashboardMetrics(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getDashboardMetrics(user.id);
  }

  @Get('tours')
  @ApiOperation({
    summary:
      'List all tours with advanced enterprise filtering and pagination.',
  })
  @ApiOkResponse({ description: 'Paginated list of tours' })
  async listTours(
    @Query() query: ListAdminToursQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.listTours(query, user.id);
  }

  @Get('tours/stats')
  @ApiOperation({
    summary: 'Get aggregated tour statistics and occupancy metrics.',
  })
  @ApiOkResponse({ description: 'Tour statistics object' })
  async getTourStats(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getTourStats(user.id);
  }

  @Get('tours/export/csv')
  @ApiOperation({ summary: 'Export tours to CSV.' })
  @ApiOkResponse({ description: 'CSV data string' })
  async exportToursCsv(
    @Query() query: ListAdminToursQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.exportToursCsv(query, user.id);
  }

  @Get('tours/:slug')
  @ApiOperation({ summary: 'Get full details for a single tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiOkResponse({ description: 'Full tour record' })
  @ApiNotFoundResponse({ description: 'Tour not found' })
  async getTourBySlug(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.getTourBySlug(slug, user.id);
  }

  @Post('tours')
  @ApiOperation({
    summary: 'Create a new tour (supports 10-step wizard data).',
  })
  @ApiBody({ type: CreateTourDto })
  @ApiOkResponse({ description: 'Tour created successfully' })
  async createTour(
    @Body() dto: CreateTourDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.createTour(dto, user.id);
  }

  @Patch('tours/bulk/update')
  @ApiOperation({ summary: 'Bulk update tours.' })
  @ApiBody({ type: BulkUpdateToursDto })
  @ApiOkResponse({ description: 'Tours updated successfully' })
  async bulkUpdateTours(
    @Body() dto: BulkUpdateToursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.bulkUpdateTours(dto, user.id);
  }

  @Patch('tours/reorder')
  @ApiOperation({
    summary: 'Bulk reorder tours by setting displayOrder for each slug.',
  })
  @ApiBody({ type: ReorderToursDto })
  @ApiOkResponse({ description: 'Tours reordered successfully' })
  async reorderTours(
    @Body() dto: ReorderToursDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.reorderTours(dto, user.id);
  }

  @Patch('tours/:slug/featured')
  @ApiOperation({ summary: 'Toggle isFeatured status for a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiBody({ schema: { properties: { isFeatured: { type: 'boolean' } } } })
  @ApiOkResponse({ description: 'Featured status updated' })
  async toggleFeatured(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Body('isFeatured') isFeatured: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.toggleFeatured(slug, isFeatured, user.id);
  }

  @Patch('tours/:slug')
  @ApiOperation({ summary: 'Update tour details.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiBody({ type: UpdateTourDto })
  @ApiOkResponse({ description: 'Updated tour record' })
  async updateTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Body() dto: UpdateTourDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateTour(slug, dto, user.id);
  }

  @Post('tours/:slug/publish')
  @ApiOperation({ summary: 'Publish a complete tour and make it public.' })
  async publishTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.publishTour(slug, user.id);
  }

  @Post('tours/:slug/unpublish')
  @ApiOperation({ summary: 'Return a public tour to draft without deleting it.' })
  async unpublishTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.unpublishTour(slug, user.id);
  }

  @Post('tours/:slug/archive')
  @ApiOperation({ summary: 'Archive a tour while preserving bookings and history.' })
  async archiveTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.archiveTour(slug, user.id);
  }

  @Post('tours/:slug/unarchive')
  @ApiOperation({ summary: 'Restore an archived/deleted tour as a non-public draft.' })
  async unarchiveTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.unarchiveTour(slug, user.id);
  }


  @Delete('tours/clear-all')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete ALL tours (nuclear wipe � SUPER_ADMIN only).' })
  @ApiOkResponse({ description: 'Count of archived tours' })
  async clearAllTours(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.clearAllTours(user.id);
  }
  @Delete('tours/:slug')
  @ApiOperation({ summary: 'Soft delete a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiOkResponse({ description: 'Tour soft deleted successfully' })
  async softDeleteTour(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.softDeleteTour(slug, user.id);
  }

  @Post('tours/:slug/images')
  @ApiOperation({ summary: 'Add an image to a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiBody({ type: AddTourImageDto })
  @ApiOkResponse({ description: 'Image added successfully' })
  async addTourImage(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Body() dto: AddTourImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.addTourImage(slug, dto, user.id);
  }

  @Delete('tours/:slug/images/:imageId')
  @ApiOperation({ summary: 'Remove an image from a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiParam({ name: 'imageId', type: 'string' })
  @ApiOkResponse({ description: 'Image removed successfully' })
  async removeTourImage(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.removeTourImage(slug, imageId, user.id);
  }

  @Patch('tours/:slug/images/:imageId/reorder')
  @ApiOperation({ summary: 'Reorder a tour image.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiParam({ name: 'imageId', type: 'string' })
  @ApiBody({ type: ReorderTourImageDto })
  @ApiOkResponse({ description: 'Image reordered successfully' })
  async reorderTourImage(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: ReorderTourImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.reorderTourImage(
      slug,
      imageId,
      dto.sortOrder,
      user.id,
    );
  }

  @Patch('tours/:slug/images/:imageId/hero')
  @ApiOperation({ summary: 'Set a tour image as the single hero image.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiParam({ name: 'imageId', type: 'string' })
  @ApiBody({ type: SetTourImageHeroDto })
  @ApiOkResponse({ description: 'Hero image updated successfully.' })
  async setTourHeroImage(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.setTourHeroImage(slug, imageId, user.id);
  }

  @Post('tours/:slug/itinerary')
  @ApiOperation({ summary: 'Add an itinerary day to a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiBody({ type: AddTourItineraryDto })
  @ApiOkResponse({ description: 'Itinerary added successfully' })
  async addTourItinerary(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Body() dto: AddTourItineraryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.addTourItinerary(slug, dto, user.id);
  }

  @Patch('tours/:slug/itinerary/:dayId')
  @ApiOperation({ summary: 'Update an itinerary day.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiParam({ name: 'dayId', type: 'string' })
  @ApiBody({ type: UpdateTourItineraryDto })
  @ApiOkResponse({ description: 'Itinerary updated successfully' })
  async updateTourItinerary(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @Body() dto: UpdateTourItineraryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateTourItinerary(slug, dayId, dto, user.id);
  }

  @Delete('tours/:slug/itinerary/:dayId')
  @ApiOperation({ summary: 'Remove an itinerary day from a tour.' })
  @ApiParam({ name: 'slug', type: 'string' })
  @ApiParam({ name: 'dayId', type: 'string' })
  @ApiOkResponse({ description: 'Itinerary removed successfully' })
  async removeTourItinerary(
    @Param('slug', ParseUuidOrSlugPipe) slug: string,
    @Param('dayId', ParseUUIDPipe) dayId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.removeTourItinerary(slug, dayId, user.id);
  }
}
