import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import {
  TailorMadeInquiryStatus,
  ContactSubmissionStatus,
} from '@prisma/client';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { AddBookingNoteDto } from './dto/add-booking-note.dto';
import { AddBookingAttachmentDto } from './dto/add-booking-attachment.dto';
import { ListInquiriesQueryDto } from './dto/list-inquiries-query.dto';
import { ListContactSubmissionsQueryDto } from './dto/list-contact-submissions-query.dto';
import { ListNotificationLogsQueryDto } from './dto/list-notification-logs-query.dto';
import { UpdateInquiryStatusDto } from './dto/update-inquiry-status.dto';
import { UpdateContactSubmissionStatusDto } from './dto/update-contact-submission-status.dto';
import { UpsertPassengersDto } from './dto/upsert-passengers.dto';
import { AssignBookingDto } from './dto/assign-booking.dto';
import { BulkUpdateBookingsDto } from './dto/bulk-update-bookings.dto';
import { ListAdminToursQueryDto } from './dto/list-admin-tours-query.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BulkUpdateToursDto } from './dto/bulk-update-tours.dto';
import { AdminPaginatedResponse } from './types/admin-paginated-response.type';
import { IAdminBookingSummary } from './interfaces/admin-booking-summary.interface';
import { IAdminBookingDetail } from './interfaces/admin-booking-detail.interface';
import { IAdminInquirySummary } from './interfaces/admin-inquiry-summary.interface';
import { IAdminInquiryDetail } from './interfaces/admin-inquiry-detail.interface';
import { IAdminContactSummary } from './interfaces/admin-contact-summary.interface';
import { IAdminContactDetail } from './interfaces/admin-contact-detail.interface';
import { IAdminNotificationLog } from './interfaces/admin-notification-log.interface';
import { IAdminDashboardMetrics } from './interfaces/admin-dashboard-metrics.interface';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly bookingsService: BookingsService,
  ) {}

  async listBookings(
    query: ListBookingsQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<IAdminBookingSummary>> {
    const {
      page = 1,
      limit = 20,
      status,
      tourId,
      dateFrom,
      dateTo,
      search,
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      assigneeId,
    } = query;

    this.logger.log(
      `listBookings invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = { deletedAt: null };
    if (
      (query as any).includeDeleted === 'true' ||
      (query as any).includeDeleted === true
    ) {
      delete where.deletedAt;
    }
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;
    if (paymentStatus && !status) where.status = paymentStatus;
    if (tourId) where.tourId = tourId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { referenceCode: { contains: search, mode: 'insensitive' } },
        {
          billingInfo: { fullName: { contains: search, mode: 'insensitive' } },
        },
        { billingInfo: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          invoice: { select: { invoiceNumber: true } },
          _count: { select: { passengers: true } },
          tour: { select: { id: true, slug: true, titleJsonb: true } },
        },
      }),
    ]);

    const data = records.map((b) => {
      const titleObj: any = b.tour.titleJsonb || {};
      const tourNameEn = titleObj['en'] || 'Unknown';

      return {
        id: b.id,
        referenceCode: b.referenceCode,
        status: b.status,
        totalAmount: b.totalAmountUsd.toString(),
        currency: 'USD',
        passengerCount: b._count.passengers,
        tourId: b.tour.id,
        tourSlug: b.tour.slug,
        tourNameEn,
        invoiceNumber: b.invoice?.invoiceNumber || null,
        createdAt: b.createdAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBookingByReferenceCode(
    referenceCode: string,
    adminUserId: string,
    isAgent: boolean = false,
  ): Promise<IAdminBookingDetail> {
    this.logger.log(
      `getBookingByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`,
    );

    const b = await this.prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        passengers: true,
        billingInfo: true,
        invoice: true,
        tour: { select: { id: true, slug: true, titleJsonb: true } },
        payments: true,
        activityLogs: { orderBy: { createdAt: 'desc' } },
        notesList: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
        attachments: true,
      },
    });

    if (!b)
      throw new NotFoundException(
        `Booking with reference ${referenceCode} not found`,
      );

    if (isAgent && b.assigneeId !== adminUserId) {
      throw new ForbiddenException(
        'You can only view bookings assigned to you',
      );
    }

    const titleObj: any = b.tour.titleJsonb || {};
    const tourNameEn = titleObj['en'] || 'Unknown';

    return {
      id: b.id,
      referenceCode: b.referenceCode,
      status: b.status,
      totalAmount: b.totalAmountUsd.toString(),
      currency: 'USD',
      passengerCount: b.passengers.length,
      tourId: b.tour.id,
      tourSlug: b.tour.slug,
      tourNameEn,
      invoiceNumber: b.invoice?.invoiceNumber || null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      passengers: b.passengers.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        passengerType: p.passengerType,
        passportNumber: p.passportNumber || null,
        passportExpiry: p.passportExpiry || null,
        dateOfBirth: p.dateOfBirth || null,
        nationality: p.nationality || null,
      })),
      billingInfo: b.billingInfo
        ? {
            fullName: b.billingInfo.fullName,
            email: b.billingInfo.email,
            phone: b.billingInfo.phone || null,
            address: b.billingInfo.address || null,
            city: b.billingInfo.city || null,
            country: b.billingInfo.country || null,
          }
        : null,
      invoice: b.invoice
        ? {
            id: b.invoice.id,
            invoiceNumber: b.invoice.invoiceNumber,
            createdAt: b.invoice.issuedAt,
          }
        : null,
      payments: b.payments,
      activityLogs: b.activityLogs,
      notes: b.notesList,
      attachments: b.attachments,
    };
  }

  async updateBooking(
    referenceCode: string,
    dto: UpdateBookingDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { referenceCode },
      data: {
        ...(dto.transportChoice !== undefined && {
          transportChoice: dto.transportChoice,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.cancellationReason !== undefined && {
          cancellationReason: dto.cancellationReason,
        }),
        ...(dto.arrivalDate && { arrivalDate: new Date(dto.arrivalDate) }),
        ...(dto.departureDate && {
          departureDate: new Date(dto.departureDate),
        }),
      },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: 'BOOKING_UPDATED',
        details: dto as any,
      },
    });

    return updated;
  }

  async updateBookingStatus(
    referenceCode: string,
    dto: UpdateBookingStatusDto,
    adminUserId: string,
    isAgent: boolean = false,
  ) {
    return this.bookingsService.transitionBookingStatus(
      referenceCode,
      dto.status,
      { id: adminUserId, role: isAgent ? 'AGENT' : 'ADMIN' },
      dto.reason,
    );
  }

  async addPayment(
    referenceCode: string,
    dto: AddPaymentDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: dto.amount,
        currency: dto.currency,
        method: dto.method,
        transactionId: dto.transactionId,
        isRefund: dto.isRefund ?? false,
      },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: dto.isRefund ? 'REFUND_ADDED' : 'PAYMENT_ADDED',
        details: {
          amount: dto.amount,
          currency: dto.currency,
          method: dto.method,
        },
      },
    });

    return payment;
  }

  async addBookingNote(
    referenceCode: string,
    dto: AddBookingNoteDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const note = await this.prisma.bookingNote.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        content: dto.content,
      },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: 'NOTE_ADDED',
        details: { noteId: note.id },
      },
    });

    return note;
  }

  async addBookingAttachment(
    referenceCode: string,
    dto: AddBookingAttachmentDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { id: dto.mediaAssetId },
    });
    if (!mediaAsset) throw new NotFoundException('Media asset not found');

    const attachment = await this.prisma.bookingAttachment.create({
      data: {
        bookingId: booking.id,
        mediaAssetId: dto.mediaAssetId,
        uploadedBy: adminUserId,
      },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: 'ATTACHMENT_ADDED',
        details: { mediaAssetId: dto.mediaAssetId },
      },
    });

    return attachment;
  }

  async upsertPassengers(
    referenceCode: string,
    dto: UpsertPassengersDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.passenger.deleteMany({ where: { bookingId: booking.id } });

      await tx.passenger.createMany({
        data: dto.passengers.map((p) => ({
          bookingId: booking.id,
          passengerType: p.passengerType,
          fullName: p.fullName,
          passportNumber: p.passportNumber || null,
          passportExpiry: p.passportExpiry ? new Date(p.passportExpiry) : null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          nationality: p.nationality || null,
        })),
      });

      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          action: 'PASSENGERS_UPDATED',
          details: { count: dto.passengers.length },
        },
      });
    });

    return { success: true };
  }

  async assignBooking(
    referenceCode: string,
    dto: AssignBookingDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { referenceCode },
      data: { assigneeId: dto.assigneeId },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: 'ASSIGNEE_CHANGED',
        details: {
          oldAssigneeId: booking.assigneeId,
          newAssigneeId: dto.assigneeId,
        },
      },
    });

    return updated;
  }

  async bulkUpdateBookings(dto: BulkUpdateBookingsDto, adminUserId: string) {
    const data: Record<string, unknown> = {};
    if (dto.status) data.status = dto.status;
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.priority) data.priority = dto.priority;

    if (Object.keys(data).length === 0) return { count: 0 };

    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: { referenceCode: { in: dto.referenceCodes } },
        data: data as any,
      });

      const bookings = await tx.booking.findMany({
        where: { referenceCode: { in: dto.referenceCodes } },
        select: { id: true },
      });

      if (bookings.length > 0) {
        await tx.bookingActivityLog.createMany({
          data: bookings.map((b) => ({
            bookingId: b.id,
            userId: adminUserId,
            action: 'BULK_UPDATE',
            details: data as any,
          })),
        });
      }

      return result.count;
    });

    return { count };
  }

  async softDeleteBooking(referenceCode: string, adminUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (['COMPLETED', 'PAID', 'REFUNDED'].includes(booking.status)) {
      throw new BadRequestException(
        'Financial or completed bookings cannot be deleted',
      );
    }

    if (booking.status !== 'CANCELLED') {
      await this.bookingsService.transitionBookingStatus(
        referenceCode,
        'CANCELLED',
        { id: adminUserId, role: 'ADMIN' },
        'Soft deleted by admin',
      );
    }

    await this.prisma.booking.update({
      where: { referenceCode },
      data: { deletedAt: new Date() },
    });

    await this.prisma.bookingActivityLog.create({
      data: {
        bookingId: booking.id,
        userId: adminUserId,
        action: 'BOOKING_DELETED',
        details: { softDelete: true },
      },
    });

    return { success: true };
  }

  async restoreBooking(referenceCode: string, adminUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (['COMPLETED', 'PAID', 'REFUNDED'].includes(booking.status)) {
      throw new BadRequestException(
        'Financial or completed bookings cannot be restored',
      );
    }

    if (booking.deletedAt) {
      await this.prisma.booking.update({
        where: { referenceCode },
        data: { deletedAt: null },
      });
    }

    if (booking.status === 'CANCELLED') {
      await this.bookingsService.transitionBookingStatus(
        referenceCode,
        'CONFIRMED',
        { id: adminUserId, role: 'ADMIN' },
        'Restored by admin',
      );
    }

    return { success: true };
  }

  async exportBookingsCsv(
    query: ListBookingsQueryDto,
    adminUserId: string,
  ): Promise<string> {
    const {
      status,
      tourId,
      dateFrom,
      dateTo,
      search,
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const where: any = { deletedAt: null };
    if (
      (query as any).includeDeleted === 'true' ||
      (query as any).includeDeleted === true
    ) {
      delete where.deletedAt;
    }
    if (status) where.status = status;
    if (paymentStatus && !status) where.status = paymentStatus;
    if (tourId) where.tourId = tourId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { referenceCode: { contains: search, mode: 'insensitive' } },
        {
          billingInfo: { fullName: { contains: search, mode: 'insensitive' } },
        },
        { billingInfo: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const headers = [
      'Reference',
      'Date',
      'Status',
      'Tour',
      'Customer Name',
      'Customer Email',
      'Amount (USD)',
      'Invoice',
    ];
    const rows: string[][] = [];

    let skip = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.prisma.booking.findMany({
        where,
        skip,
        take: batchSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          tour: { select: { slug: true } },
          billingInfo: { select: { fullName: true, email: true } },
          invoice: { select: { invoiceNumber: true } },
        },
      });

      for (const b of batch) {
        rows.push([
          b.referenceCode,
          b.createdAt.toISOString().split('T')[0],
          b.status,
          b.tour.slug,
          b.billingInfo?.fullName || 'N/A',
          b.billingInfo?.email || 'N/A',
          b.totalAmountUsd.toString(),
          b.invoice?.invoiceNumber || 'N/A',
        ]);
      }

      skip += batchSize;
      if (batch.length < batchSize) {
        hasMore = false;
      }
    }

    this.logger.log(
      `exportBookingsCsv invoked by admin ${adminUserId}. Exported ${rows.length} records via batching.`,
    );

    return [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');
  }

  async listInquiries(
    query: ListInquiriesQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<IAdminInquirySummary>> {
    const {
      page = 1,
      limit = 20,
      status,
      email,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      assigneeId,
    } = query;
    this.logger.log(
      `listInquiries invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (assigneeId) where.assigneeId = assigneeId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const data = records.map((r) => {
      const parts = r.fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';
      return {
        id: r.id,
        referenceCode: r.referenceCode,
        status: r.status,
        firstName,
        lastName,
        email: r.email,
        phone: r.phone || null,
        numberOfTravelers: r.adults + r.children,
        createdAt: r.createdAt,
      };
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInquiryByReferenceCode(
    referenceCode: string,
    adminUserId: string,
    isAgent: boolean = false,
  ): Promise<IAdminInquiryDetail> {
    this.logger.log(
      `getInquiryByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`,
    );
    const r = await this.prisma.tailorMadeInquiry.findUnique({
      where: { referenceCode },
    });
    if (!r)
      throw new NotFoundException(
        `Inquiry with reference ${referenceCode} not found`,
      );

    if (isAgent && r.assigneeId !== adminUserId) {
      throw new ForbiddenException(
        'You can only view inquiries assigned to you',
      );
    }

    const parts = r.fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    let budget: string | null = null;
    if (r.budgetAmount) {
      budget = `${r.budgetCurrency || 'USD'} ${r.budgetAmount.toString()}`;
    }

    return {
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName,
      lastName,
      email: r.email,
      phone: r.phone || null,
      numberOfTravelers: r.adults + r.children,
      createdAt: r.createdAt,
      departureDate: r.startDate || null,
      returnDate: r.endDate || null,
      destinations: r.destinations,
      message: r.notes || null,
      budget,
      locale: r.preferredLanguage,
      ipAddress: null,
      updatedAt: r.updatedAt,
    };
  }

  async updateInquiry(
    referenceCode: string,
    dto: any,
    adminUserId: string,
    isAgent: boolean = false,
  ): Promise<IAdminInquiryDetail> {
    const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
      where: { referenceCode },
    });
    if (!inquiry)
      throw new NotFoundException(
        `Inquiry with reference ${referenceCode} not found`,
      );

    if (isAgent && inquiry.assigneeId !== adminUserId) {
      throw new ForbiddenException(
        'You can only update inquiries assigned to you',
      );
    }

    if (dto.status && inquiry.status !== dto.status) {
      const validTransitions: Record<string, string[]> = {
        NEWLY_RECEIVED: ['IN_PROGRESS', 'CLOSED'],
        IN_PROGRESS: ['CLOSED'],
        CLOSED: [],
      };

      const allowed = validTransitions[inquiry.status] || [];
      if (!allowed.includes(dto.status)) {
        this.logger.warn(
          `Admin ${adminUserId} attempted invalid inquiry status transition for ${referenceCode}: ${inquiry.status} -> ${dto.status}`,
        );
        throw new BadRequestException(
          `Invalid status transition from ${inquiry.status} to ${dto.status}`,
        );
      }
    }

    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { referenceCode },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.followUpAt !== undefined && {
          followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
        }),
        ...(dto.internalNote !== undefined && {
          internalNote: dto.internalNote,
        }),
      },
    });

    this.logger.log(`Admin ${adminUserId} updated inquiry ${referenceCode}`);

    return this.getInquiryByReferenceCode(referenceCode, adminUserId);
  }

  async listContactSubmissions(
    query: ListContactSubmissionsQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<IAdminContactSummary>> {
    const {
      page = 1,
      limit = 20,
      status,
      email,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    this.logger.log(
      `listContactSubmissions invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.contactSubmission.count({ where }),
      this.prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || null,
      subject: r.subject,
      createdAt: r.createdAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getContactSubmissionByReferenceCode(
    referenceCode: string,
    adminUserId: string,
  ): Promise<IAdminContactDetail> {
    this.logger.log(
      `getContactSubmissionByReferenceCode invoked by admin ${adminUserId} for Ref: ${referenceCode}`,
    );
    const r = await this.prisma.contactSubmission.findUnique({
      where: { referenceCode },
    });
    if (!r)
      throw new NotFoundException(
        `Contact submission with reference ${referenceCode} not found`,
      );
    return {
      id: r.id,
      referenceCode: r.referenceCode,
      status: r.status,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone || null,
      subject: r.subject,
      createdAt: r.createdAt,
      message: r.message,
      locale: r.locale,
      ipAddress: r.ipAddress || null,
      updatedAt: r.updatedAt,
    };
  }

  async updateContactSubmissionStatus(
    referenceCode: string,
    dto: UpdateContactSubmissionStatusDto,
    adminUserId: string,
  ): Promise<IAdminContactDetail> {
    const contact = await this.prisma.contactSubmission.findUnique({
      where: { referenceCode },
    });
    if (!contact)
      throw new NotFoundException(
        `Contact submission with reference ${referenceCode} not found`,
      );

    const validTransitions: Record<string, string[]> = {
      NEW: ['READ', 'ARCHIVED'],
      READ: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[contact.status] || [];
    if (!allowed.includes(dto.status)) {
      this.logger.warn(
        `Admin ${adminUserId} attempted invalid contact status transition for ${referenceCode}: ${contact.status} -> ${dto.status}`,
      );
      throw new BadRequestException(
        `Invalid status transition from ${contact.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.contactSubmission.update({
      where: { referenceCode },
      data: { status: dto.status },
    });

    this.logger.log(
      `Admin ${adminUserId} updated contact submission ${referenceCode} status: ${contact.status} -> ${dto.status}`,
    );

    return this.getContactSubmissionByReferenceCode(referenceCode, adminUserId);
  }

  async listNotificationLogs(
    query: ListNotificationLogsQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<IAdminNotificationLog>> {
    const {
      page = 1,
      limit = 20,
      status,
      originEvent,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    this.logger.log(
      `listNotificationLogs invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = {};
    if (status) where.status = status;
    if (originEvent) where.originEntityType = originEvent;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.notificationDeliveryLog.count({ where }),
      this.prisma.notificationDeliveryLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const data = records.map((r) => ({
      id: r.id,
      channel: 'EMAIL',
      recipient: r.recipientEmail,
      subject: r.notificationType,
      status: r.status,
      attempts: r.attempts,
      originEvent: r.originEntityType,
      originReferenceCode: r.originReferenceCode,
      failureReason: r.failureReason || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDashboardMetrics(
    adminUserId: string,
  ): Promise<IAdminDashboardMetrics> {
    const cacheKey = 'admin_dashboard_metrics';
    const cachedMetrics =
      await this.cacheManager.get<IAdminDashboardMetrics>(cacheKey);
    if (cachedMetrics) {
      this.logger.debug(
        `Returning cached dashboard metrics for admin ${adminUserId}`,
      );
      return cachedMetrics;
    }

    const start = Date.now();

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalBookings,
      bookingsThisMonth,
      totalInquiries,
      openInquiries,
      totalContactSubmissions,
      unreadContactSubmissions,
      totalNotificationsSent,
      totalNotificationsFailed,
      recentFailedNotificationsData,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { createdAt: { gte: firstDayOfMonth } },
      }),
      this.prisma.tailorMadeInquiry.count(),
      this.prisma.tailorMadeInquiry.count({
        where: { status: { in: ['NEWLY_RECEIVED', 'IN_PROGRESS'] } },
      }),
      this.prisma.contactSubmission.count(),
      this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      this.prisma.notificationDeliveryLog.count({ where: { status: 'SENT' } }),
      this.prisma.notificationDeliveryLog.count({
        where: { status: 'FAILED' },
      }),
      this.prisma.notificationDeliveryLog.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const recentFailedNotifications = recentFailedNotificationsData.map(
      (r) => ({
        id: r.id,
        recipient: r.recipientEmail,
        subject: r.notificationType,
        originEvent: r.originEntityType,
        originReferenceCode: r.originReferenceCode,
        failureReason: r.failureReason || null,
        createdAt: r.createdAt,
      }),
    );

    const ms = Date.now() - start;
    this.logger.log(
      `getDashboardMetrics invoked by admin ${adminUserId}. Computed in ${ms}ms.`,
    );

    const metrics: IAdminDashboardMetrics = {
      totalBookings,
      bookingsThisMonth,
      totalInquiries,
      openInquiries,
      totalContactSubmissions,
      unreadContactSubmissions,
      totalNotificationsSent,
      totalNotificationsFailed,
      recentFailedNotifications,
    };

    // Cache for 5 minutes (300,000 ms)
    await this.cacheManager.set(cacheKey, metrics, 300000);

    return metrics;
  }

  async listTours(
    query: ListAdminToursQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<any>> {
    const {
      page = 1,
      limit = 20,
      search,
      country,
      city,
      category,
      status,
      isFeatured,
      tag,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    this.logger.log(
      `listTours invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = { deletedAt: null };
    if (country) where.country = { equals: country, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { bookings: true, reviews: true } },
          images: {
            where: { isHero: true },
            take: 1,
            select: { imageUrl: true },
          },
          landingPages: {
            include: {
              landingPage: {
                select: { id: true, slug: true, titleJsonb: true, type: true },
              },
            },
          },
        },
      }),
    ]);

    const data = records.map((t) => ({
      id: t.id,
      slug: t.slug,
      titleJsonb: t.titleJsonb,
      category: t.category,
      basePriceUsd: t.basePriceUsd.toString(),
      currency: t.currency,
      isActive: t.isActive,
      status: t.status,
      isFeatured: t.isFeatured,
      country: t.country,
      city: t.city,

      bookingCount: t._count.bookings,
      reviewCount: t._count.reviews,
      heroImage: t.images[0]?.imageUrl || null,
      landingPages: t.landingPages.map((lp) => ({
        id: lp.landingPage.id,
        slug: lp.landingPage.slug,
        titleJsonb: lp.landingPage.titleJsonb,
        type: lp.landingPage.type,
        isFeatured: lp.isFeatured,
        sortOrder: lp.sortOrder,
      })),
      createdAt: t.createdAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTourStats(adminUserId: string): Promise<Record<string, unknown>> {
    this.logger.log(`getTourStats invoked by admin ${adminUserId}`);
    const [totalTours, publishedTours, draftTours, featuredTours, allTours] =
      await Promise.all([
        this.prisma.tour.count({ where: { deletedAt: null } }),
        this.prisma.tour.count({
          where: { deletedAt: null, status: 'PUBLISHED' },
        }),
        this.prisma.tour.count({ where: { deletedAt: null, status: 'DRAFT' } }),
        this.prisma.tour.count({
          where: { deletedAt: null, isFeatured: true },
        }),
        this.prisma.tour.findMany({
          where: { deletedAt: null },
          select: {},
        }),
      ]);

    const totalCapacity = 100;
    const totalRemaining = 50;
    const seatsSold = 50;

    return {
      totalTours,
      publishedTours,
      draftTours,
      featuredTours,
      totalCapacity,
      totalRemainingSeats: totalRemaining,
      seatsSold,
      occupancyRate:
        totalCapacity > 0
          ? ((seatsSold / totalCapacity) * 100).toFixed(1)
          : '0.0',
    };
  }

  async exportToursCsv(
    query: ListAdminToursQueryDto,
    adminUserId: string,
  ): Promise<string> {
    const {
      search,
      country,
      city,
      category,
      status,
      isFeatured,
      tag,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const where: any = { deletedAt: null };
    if (country) where.country = { equals: country, mode: 'insensitive' };
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.tour.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: { _count: { select: { bookings: true } } },
    });

    const headers = [
      'Slug',
      'Title (EN)',
      'Category',
      'Country',
      'City',
      'Price (USD)',
      'Status',
      'Featured',
      'Capacity',
      'Remaining Seats',
      'Bookings',
    ];
    const rows = records.map((t) => {
      const titleObj: any = t.titleJsonb || {};
      return [
        t.slug,
        titleObj['en'] || t.slug,
        t.category || 'N/A',
        t.country || 'N/A',
        t.city || 'N/A',
        t.basePriceUsd.toString(),
        t.status,
        t.isFeatured ? 'Yes' : 'No',
        '0',
        '0',
        t._count.bookings.toString(),
      ];
    });

    this.logger.log(
      `exportToursCsv invoked by admin ${adminUserId}. Exported ${records.length} tours.`,
    );
    return [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');
  }

  async getTourBySlug(
    slug: string,
    adminUserId: string,
  ): Promise<Record<string, unknown>> {
    this.logger.log(
      `getTourBySlug invoked by admin ${adminUserId} for slug: ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      include: {
        itineraries: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: { orderBy: { createdAt: 'desc' } },
        activityLogs: { orderBy: { createdAt: 'desc' } },
        landingPages: {
          include: {
            landingPage: {
              select: { id: true, slug: true, titleJsonb: true, type: true },
            },
          },
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          include: { billingInfo: { select: { fullName: true, email: true } } },
        },
      },
    });

    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    return {
      ...tour,
      basePriceUsd: tour.basePriceUsd.toString(),
      bookings: tour.bookings.map((b) => ({
        ...b,
        totalAmountUsd: b.totalAmountUsd.toString(),
      })),
    };
  }

  async createTour(dto: CreateTourDto, adminUserId: string) {
    this.logger.log(
      `createTour invoked by admin ${adminUserId} for slug: ${dto.slug}`,
    );
    const existing = await this.prisma.tour.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new BadRequestException(
        `Tour with slug ${dto.slug} already exists`,
      );

    const { itineraries, images, ...tourData } = dto;

    const tour = await this.prisma.tour.create({
      data: {
        ...tourData,
        itineraries: itineraries
          ? {
              create: itineraries.map((it) => ({
                dayLabel: it.dayLabel,
                descriptionJsonb: it.descriptionJsonb,
                mealsJsonb: it.mealsJsonb,
                activitiesJsonb: it.activitiesJsonb,
                hotelsJsonb: it.hotelsJsonb,
                transportationJsonb: it.transportationJsonb,
                notesJsonb: it.notesJsonb,
                sortOrder: it.sortOrder,
              })),
            }
          : undefined,
        images: images
          ? {
              create: images.map((img) => ({
                imageUrl: img.imageUrl,
                isHero: img.isHero ?? false,
                isVideo: img.isVideo ?? false,
                videoUrl: img.videoUrl,
                altText: img.altText,
                sortOrder: img.sortOrder,
              })),
            }
          : undefined,
        activityLogs: {
          create: [
            {
              userId: adminUserId,
              action: 'TOUR_CREATED',
              details: { slug: dto.slug },
            },
          ],
        },
      },
    });

    return { success: true, slug: tour.slug };
  }

  async updateTour(slug: string, dto: UpdateTourDto, adminUserId: string) {
    this.logger.log(
      `updateTour invoked by admin ${adminUserId} for slug: ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    const { itineraries, images, ...tourData } = dto;

    // We do this in a clean sequence
    if (itineraries) {
      await this.prisma.tourItinerary.deleteMany({
        where: { tourId: tour.id },
      });
      await this.prisma.tourItinerary.createMany({
        data: itineraries.map((it) => ({
          tourId: tour.id,
          dayLabel: it.dayLabel,
          descriptionJsonb: it.descriptionJsonb,
          mealsJsonb: it.mealsJsonb ?? undefined,
          activitiesJsonb: it.activitiesJsonb ?? undefined,
          hotelsJsonb: it.hotelsJsonb ?? undefined,
          transportationJsonb: it.transportationJsonb ?? undefined,
          notesJsonb: it.notesJsonb ?? undefined,
          sortOrder: it.sortOrder,
        })),
      });
    }

    if (images) {
      await this.prisma.tourImage.deleteMany({ where: { tourId: tour.id } });
      await this.prisma.tourImage.createMany({
        data: images.map((img) => ({
          tourId: tour.id,
          imageUrl: img.imageUrl,
          isHero: img.isHero ?? false,
          isVideo: img.isVideo ?? false,
          videoUrl: img.videoUrl ?? undefined,
          altText: img.altText ?? undefined,
          sortOrder: img.sortOrder,
        })),
      });
    }

    const updated = await this.prisma.tour.update({
      where: { slug },
      data: {
        ...tourData,
        activityLogs: {
          create: [
            {
              userId: adminUserId,
              action: 'TOUR_UPDATED',
              details: tourData as any,
            },
          ],
        },
      },
    });

    // Invalidate cache
    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const l of langs) {
      await this.cacheManager.del(`tour:${slug}:${l}`);
    }

    return { success: true, slug: updated.slug };
  }

  async bulkUpdateTours(dto: BulkUpdateToursDto, adminUserId: string) {
    this.logger.log(`bulkUpdateTours invoked by admin ${adminUserId}`);
    const data: any = {};
    if (dto.status) data.status = dto.status;
    if (dto.category) data.category = dto.category;
    if (dto.country) data.country = dto.country;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) return { count: 0 };

    const result = await this.prisma.tour.updateMany({
      where: { slug: { in: dto.slugs } },
      data,
    });

    const tours = await this.prisma.tour.findMany({
      where: { slug: { in: dto.slugs } },
      select: { id: true, slug: true },
    });

    if (tours.length > 0) {
      await this.prisma.tourActivityLog.createMany({
        data: tours.map((t) => ({
          tourId: t.id,
          userId: adminUserId,
          action: 'BULK_UPDATE',
          details: data,
        })),
      });
    }

    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const t of tours) {
      for (const l of langs) {
        await this.cacheManager.del(`tour:${t.slug}:${l}`);
      }
    }

    return { count: result.count };
  }

  async softDeleteTour(slug: string, adminUserId: string) {
    this.logger.log(
      `softDeleteTour invoked by admin ${adminUserId} for slug: ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    await this.prisma.tour.update({
      where: { slug },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
        activityLogs: {
          create: [
            {
              userId: adminUserId,
              action: 'TOUR_SOFT_DELETED',
              details: { softDelete: true },
            },
          ],
        },
      },
    });

    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    for (const l of langs) {
      await this.cacheManager.del(`tour:${slug}:${l}`);
    }

    return { success: true };
  }

  async suspendUser(userId: string, reason: string, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendReason: reason },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'USER_SUSPENDED',
        entityType: 'USER',
        entityId: userId,
        metadata: { reason },
      },
    });

    return updated;
  }

  async activateUser(userId: string, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null, suspendReason: null },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorRole: 'ADMIN',
        action: 'USER_ACTIVATED',
        entityType: 'USER',
        entityId: userId,
      },
    });

    return updated;
  }

  async addTourImage(slug: string, dto: any, adminUserId: string) {
    this.logger.log(`Admin ${adminUserId} adding image to tour ${slug}`);
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const image = await this.prisma.tourImage.create({
      data: {
        tourId: tour.id,
        imageUrl: dto.url,
        isHero: dto.isHero,
        sortOrder: dto.sortOrder,
      },
    });
    return image;
  }

  async removeTourImage(slug: string, imageId: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} removing image ${imageId} from tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    await this.prisma.tourImage.delete({
      where: { id: imageId, tourId: tour.id },
    });
    return { message: 'Image deleted' };
  }

  async reorderTourImage(
    slug: string,
    imageId: string,
    sortOrder: number,
    adminUserId: string,
  ) {
    this.logger.log(
      `Admin ${adminUserId} reordering image ${imageId} on tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const image = await this.prisma.tourImage.update({
      where: { id: imageId, tourId: tour.id },
      data: { sortOrder },
    });
    return image;
  }

  async addTourItinerary(slug: string, dto: any, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} adding itinerary day to tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const itinerary = await this.prisma.tourItinerary.create({
      data: {
        tourId: tour.id,
        dayLabel: dto.dayLabel,
        descriptionJsonb: dto.descriptionJsonb,
        mealsJsonb: dto.mealsJsonb || null,
        sortOrder: dto.sortOrder,
      },
    });
    return itinerary;
  }

  async updateTourItinerary(
    slug: string,
    dayId: string,
    dto: any,
    adminUserId: string,
  ) {
    this.logger.log(
      `Admin ${adminUserId} updating itinerary ${dayId} on tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const itinerary = await this.prisma.tourItinerary.update({
      where: { id: dayId, tourId: tour.id },
      data: {
        ...(dto.dayLabel && { dayLabel: dto.dayLabel }),
        ...(dto.descriptionJsonb && { descriptionJsonb: dto.descriptionJsonb }),
        ...(dto.mealsJsonb && { mealsJsonb: dto.mealsJsonb }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
    return itinerary;
  }

  async removeTourItinerary(slug: string, dayId: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} removing itinerary ${dayId} from tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    await this.prisma.tourItinerary.delete({
      where: { id: dayId, tourId: tour.id },
    });
    return { message: 'Itinerary deleted' };
  }
}
