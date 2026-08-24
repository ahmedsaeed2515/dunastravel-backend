import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import {
  TailorMadeInquiryStatus,
  ContactSubmissionStatus,
  MediaEntityType,
  Prisma,
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
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { UpdateContactSubmissionStatusDto } from './dto/update-contact-submission-status.dto';
import { UpsertPassengersDto } from './dto/upsert-passengers.dto';
import { AssignBookingDto } from './dto/assign-booking.dto';
import { BulkUpdateBookingsDto } from './dto/bulk-update-bookings.dto';
import { ListAdminToursQueryDto } from './dto/list-admin-tours-query.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BulkUpdateToursDto } from './dto/bulk-update-tours.dto';
import { AddTourImageDto } from './dto/add-tour-image.dto';
import { AddTourItineraryDto } from './dto/add-tour-itinerary.dto';
import { UpdateTourItineraryDto } from './dto/update-tour-itinerary.dto';
import { AdminPaginatedResponse } from './types/admin-paginated-response.type';
import { IAdminBookingSummary } from './interfaces/admin-booking-summary.interface';
import { IAdminBookingDetail } from './interfaces/admin-booking-detail.interface';
import { IAdminInquirySummary } from './interfaces/admin-inquiry-summary.interface';
import { IAdminInquiryDetail } from './interfaces/admin-inquiry-detail.interface';
import { IAdminContactSummary } from './interfaces/admin-contact-summary.interface';
import { IAdminContactDetail } from './interfaces/admin-contact-detail.interface';
import { IAdminNotificationLog } from './interfaces/admin-notification-log.interface';
import { IAdminDashboardMetrics } from './interfaces/admin-dashboard-metrics.interface';
import {
  sanitizeHtmlContent,
  sanitizePlainText,
} from '../../common/utils/content-sanitizer.util';
import { sanitizeCsvField } from '../../common/utils/sanitize.util';
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from '../../common/security/field-encryption.util';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly bookingsService: BookingsService,
  ) {}

  async assertActiveBookingCustomer(
    userId: string,
    email: string,
  ): Promise<void> {
    const customer = await this.prisma.user.findFirst({
      where: {
        id: userId,
        email: { equals: email.trim(), mode: 'insensitive' },
        role: 'USER',
        status: 'ACTIVE',
        suspendedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(
        'Booking customer must be an active user matching the billing email',
      );
    }
  }

  async recordManualBookingCreation(
    bookingId: string,
    actorId: string,
    actorRole: string,
    customerId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { id: true },
        });
        if (!booking) {
          throw new NotFoundException('Created booking was not found');
        }

        const alreadyRecorded = await tx.bookingActivityLog.findFirst({
          where: {
            bookingId,
            userId: actorId,
            action: 'MANUAL_BOOKING_CREATED',
          },
          select: { id: true },
        });
        if (alreadyRecorded) return;

        await tx.bookingActivityLog.create({
          data: {
            bookingId,
            userId: actorId,
            action: 'MANUAL_BOOKING_CREATED',
            details: { customerId: customerId ?? null },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            actorRole,
            action: 'MANUAL_BOOKING_CREATED',
            entityType: 'BOOKING',
            entityId: bookingId,
            metadata: { customerId: customerId ?? null },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listBookings(
    query: ListBookingsQueryDto,
    adminUserId: string,
  ): Promise<AdminPaginatedResponse<IAdminBookingSummary>> {
    const page = query.page && Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = query.limit && Number(query.limit) > 0 ? Number(query.limit) : 20;
    const {
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

    this.logger.log(`listBookings invoked by admin ${adminUserId}`);

    const where: Prisma.BookingWhereInput = { deletedAt: null };
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;
    if (paymentStatus && !status) where.status = paymentStatus;
    if (tourId) where.tourId = tourId;
    if (dateFrom || dateTo) {
      if (
        dateFrom &&
        dateTo &&
        new Date(dateTo).getTime() - new Date(dateFrom).getTime() >
          366 * 24 * 60 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Booking date range cannot exceed 366 days',
        );
      }
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

    const b = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        passengers: true,
        billingInfo: true,
        invoice: true,
        tour: { select: { id: true, slug: true, titleJsonb: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            transactionId: true,
            status: true,
            isRefund: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 500,
        },
        notesList: {
          orderBy: { createdAt: 'desc' },
          take: 500,
          include: { user: { select: { name: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          take: 500,
        },
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
        passportNumber: decryptSensitiveField(p.passportNumber) || null,
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
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      select: {
        id: true,
        arrivalDate: true,
        departureDate: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const arrivalDate = dto.arrivalDate
      ? new Date(dto.arrivalDate)
      : booking.arrivalDate;
    const departureDate = dto.departureDate
      ? new Date(dto.departureDate)
      : booking.departureDate;
    if (departureDate && departureDate < arrivalDate) {
      throw new BadRequestException(
        'Departure date cannot be before arrival date',
      );
    }
    const tags = dto.tags
      ? [
          ...new Set(
            dto.tags
              .map((tag) => sanitizePlainText(tag).slice(0, 50))
              .filter(Boolean),
          ),
        ]
      : undefined;
    const changedFields = Object.keys(dto);

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: { id: booking.id, deletedAt: null },
        data: {
          ...(dto.transportChoice !== undefined && {
            transportChoice: sanitizePlainText(dto.transportChoice).slice(
              0,
              100,
            ),
          }),
          ...(dto.notes !== undefined && {
            notes: sanitizePlainText(dto.notes).slice(0, 5_000),
          }),
          ...(dto.cancellationReason !== undefined && {
            cancellationReason: sanitizePlainText(
              dto.cancellationReason,
            ).slice(0, 2_000),
          }),
          ...(dto.arrivalDate && { arrivalDate }),
          ...(dto.departureDate && { departureDate }),
          ...(tags && { tags }),
          ...(dto.priority && { priority: dto.priority }),
        },
      });
      if (changed.count !== 1) {
        throw new NotFoundException('Booking not found');
      }
      const updated = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: {
          id: true,
          referenceCode: true,
          status: true,
          arrivalDate: true,
          departureDate: true,
          transportChoice: true,
          notes: true,
          cancellationReason: true,
          priority: true,
          tags: true,
          updatedAt: true,
        },
      });
      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          action: 'BOOKING_UPDATED',
          details: { changedFields },
        },
      });
      return updated;
    });
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
    const amount = new Prisma.Decimal(dto.amount);
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.payment.findFirst({
          where: { transactionId: dto.transactionId },
          select: {
            id: true,
            bookingId: true,
            amount: true,
            currency: true,
            method: true,
            transactionId: true,
            status: true,
            createdAt: true,
          },
        });
        const booking = await tx.booking.findFirst({
          where: { referenceCode, deletedAt: null },
          select: {
            id: true,
            status: true,
            totalAmountUsd: true,
          },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        if (existing) {
          if (
            existing.bookingId === booking.id &&
            existing.amount.equals(amount) &&
            existing.currency === dto.currency &&
            existing.method === dto.method &&
            existing.status === 'CAPTURED'
          ) {
            return existing;
          }
          throw new ConflictException(
            'Transaction reference was already used',
          );
        }
        if (
          ['CANCELLED', 'REFUNDED', 'ARCHIVED'].includes(booking.status)
        ) {
          throw new BadRequestException(
            'Payments cannot be added to this booking',
          );
        }

        const captured = await tx.payment.aggregate({
          where: {
            bookingId: booking.id,
            status: 'CAPTURED',
            isRefund: false,
          },
          _sum: { amount: true },
        });
        const currentPaid = captured._sum.amount ?? new Prisma.Decimal(0);
        const newPaid = currentPaid.plus(amount);
        if (newPaid.gt(booking.totalAmountUsd)) {
          throw new BadRequestException(
            'Payment exceeds the outstanding booking balance',
          );
        }
        const nextStatus = newPaid.equals(booking.totalAmountUsd)
          ? 'PAID'
          : 'PARTIALLY_PAID';

        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount,
            currency: dto.currency,
            method: dto.method,
            transactionId: dto.transactionId,
            status: 'CAPTURED',
            isRefund: false,
          },
          select: {
            id: true,
            bookingId: true,
            amount: true,
            currency: true,
            method: true,
            transactionId: true,
            status: true,
            createdAt: true,
          },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            paidAmountUsd: newPaid,
            status: nextStatus,
          },
        });
        await tx.bookingActivityLog.create({
          data: {
            bookingId: booking.id,
            userId: adminUserId,
            action: 'MANUAL_PAYMENT_CAPTURED',
            details: {
              paymentId: payment.id,
              amount: amount.toString(),
              currency: dto.currency,
              method: dto.method,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminUserId,
            actorRole: 'SUPER_ADMIN',
            action: 'MANUAL_PAYMENT_CAPTURED',
            entityType: 'PAYMENT',
            entityId: payment.id,
            metadata: {
              bookingId: booking.id,
              amount: amount.toString(),
              currency: dto.currency,
              method: dto.method,
            },
          },
        });
        return payment;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async addBookingNote(
    referenceCode: string,
    dto: AddBookingNoteDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const content = sanitizePlainText(dto.content).slice(0, 5_000);
    if (!content) throw new BadRequestException('Note cannot be empty');
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.bookingNote.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          content,
        },
      });
      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          action: 'NOTE_ADDED',
          details: { noteId: note.id },
        },
      });
      return note;
    });
  }

  async addBookingAttachment(
    referenceCode: string,
    dto: AddBookingAttachmentDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.$transaction(
      async (tx) => {
        const mediaAsset = await tx.mediaAsset.findFirst({
          where: {
            id: dto.mediaAssetId,
            deletedAt: null,
            entityType: MediaEntityType.GENERAL,
            uploadedBy: adminUserId,
          },
          select: { id: true },
        });
        if (!mediaAsset) {
          throw new NotFoundException('Media asset not found');
        }

        const [bookingAttachment, customerDocument] = await Promise.all([
          tx.bookingAttachment.findFirst({
            where: { mediaAssetId: dto.mediaAssetId },
            select: { id: true },
          }),
          tx.customerDocument.findFirst({
            where: { mediaAssetId: dto.mediaAssetId },
            select: { id: true },
          }),
        ]);
        if (bookingAttachment || customerDocument) {
          throw new BadRequestException('Media asset is already attached');
        }

        const attachment = await tx.bookingAttachment.create({
          data: {
            bookingId: booking.id,
            mediaAssetId: dto.mediaAssetId,
            uploadedBy: adminUserId,
          },
        });

        await tx.bookingActivityLog.create({
          data: {
            bookingId: booking.id,
            userId: adminUserId,
            action: 'ATTACHMENT_ADDED',
            details: { mediaAssetId: dto.mediaAssetId },
          },
        });
        return attachment;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async upsertPassengers(
    referenceCode: string,
    dto: UpsertPassengersDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      select: {
        id: true,
        adults: true,
        children: true,
        infants: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const expectedCounts = {
      ADULT: booking.adults,
      CHILD: booking.children,
      INFANT: booking.infants,
    };
    for (const [type, expected] of Object.entries(expectedCounts)) {
      const actual = dto.passengers.filter(
        (passenger) => passenger.passengerType === type,
      ).length;
      if (actual !== expected) {
        throw new BadRequestException(
          `Passenger count for ${type} must equal the booking count`,
        );
      }
    }
    const now = new Date();
    for (const passenger of dto.passengers) {
      if (passenger.dateOfBirth && new Date(passenger.dateOfBirth) > now) {
        throw new BadRequestException(
          'Passenger date of birth cannot be in the future',
        );
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.passenger.deleteMany({ where: { bookingId: booking.id } });
        await tx.passenger.createMany({
          data: dto.passengers.map((p) => ({
            bookingId: booking.id,
            passengerType: p.passengerType,
            fullName: sanitizePlainText(p.fullName).slice(0, 255),
            passportNumber: p.passportNumber
              ? encryptSensitiveField(p.passportNumber.toUpperCase())
              : null,
            passportExpiry: p.passportExpiry
              ? new Date(p.passportExpiry)
              : null,
            dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
            nationality: p.nationality
              ? sanitizePlainText(p.nationality).slice(0, 100)
              : null,
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
      },
      { isolationLevel: 'Serializable' },
    );

    return { success: true };
  }

  async assignBooking(
    referenceCode: string,
    dto: AssignBookingDto,
    adminUserId: string,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      select: { id: true, assigneeId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: {
          id: dto.assigneeId,
          role: { in: ['ADMIN', 'AGENT'] },
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException(
          'Assignee must be an active admin or agent',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { referenceCode },
        data: { assigneeId: dto.assigneeId ?? null },
        select: {
          id: true,
          referenceCode: true,
          assigneeId: true,
          updatedAt: true,
        },
      });
      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          action: 'ASSIGNEE_CHANGED',
          details: {
            oldAssigneeId: booking.assigneeId,
            newAssigneeId: dto.assigneeId ?? null,
          },
        },
      });
      return updated;
    });
  }

  async bulkUpdateBookings(dto: BulkUpdateBookingsDto, adminUserId: string) {
    const data: Record<string, unknown> = {};
    if (dto.assigneeId !== undefined) data.assigneeId = dto.assigneeId;
    if (dto.priority) data.priority = dto.priority;

    if (Object.keys(data).length === 0) return { count: 0 };
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: {
          id: dto.assigneeId,
          role: { in: ['ADMIN', 'AGENT'] },
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException(
          'Assignee must be an active admin or agent',
        );
      }
    }

    const count = await this.prisma.$transaction(async (tx) => {
      const result = await tx.booking.updateMany({
        where: {
          referenceCode: { in: dto.referenceCodes },
          deletedAt: null,
        },
        data: data as any,
      });

      const bookings = await tx.booking.findMany({
        where: {
          referenceCode: { in: dto.referenceCodes },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (bookings.length > 0) {
        await tx.bookingActivityLog.createMany({
          data: bookings.map((b) => ({
            bookingId: b.id,
            userId: adminUserId,
            action: 'BULK_UPDATE',
            details: { changedFields: Object.keys(data) },
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

    if (
      ['COMPLETED', 'PAID', 'PARTIALLY_PAID', 'REFUNDED'].includes(
        booking.status,
      )
    ) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { referenceCode },
        data: { deletedAt: new Date() },
      });
      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: adminUserId,
          action: 'BOOKING_DELETED',
          details: { softDelete: true },
        },
      });
    });

    return { success: true };
  }

  async restoreBooking(referenceCode: string, adminUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      ['COMPLETED', 'PAID', 'PARTIALLY_PAID', 'REFUNDED'].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException(
        'Financial or completed bookings cannot be restored',
      );
    }

    if (booking.status === 'CANCELLED') {
      await this.bookingsService.transitionBookingStatus(
        referenceCode,
        'CONFIRMED',
        { id: adminUserId, role: 'ADMIN' },
        'Restored by admin',
      );
    }
    if (booking.deletedAt) {
      await this.prisma.booking.update({
        where: { referenceCode },
        data: { deletedAt: null },
      });
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
      if (
        dateFrom &&
        dateTo &&
        new Date(dateTo).getTime() - new Date(dateFrom).getTime() >
          366 * 24 * 60 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Booking export date range cannot exceed 366 days',
        );
      }
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
      ...rows.map((row) =>
        row.map((cell) => this.toCsvCell(cell)).join(','),
      ),
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
    this.logger.log(`listInquiries invoked by admin ${adminUserId}`);

    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (assigneeId) where.assigneeId = assigneeId;
    if (dateFrom || dateTo) {
      if (
        dateFrom &&
        dateTo &&
        new Date(dateTo).getTime() - new Date(dateFrom).getTime() >
          366 * 24 * 60 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Inquiry date range cannot exceed 366 days',
        );
      }
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
        select: {
          id: true,
          referenceCode: true,
          status: true,
          fullName: true,
          email: true,
          phone: true,
          adults: true,
          children: true,
          createdAt: true,
        },
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
    dto: UpdateInquiryDto,
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
    if (isAgent && dto.assigneeId !== undefined) {
      throw new ForbiddenException('Agents cannot reassign inquiries');
    }
    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: {
          id: dto.assigneeId,
          role: 'AGENT',
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException('Assignee must be an active agent');
      }
    }

    if (dto.status && inquiry.status !== dto.status) {
      const validTransitions: Record<string, string[]> = {
        NEWLY_RECEIVED: ['IN_PROGRESS', 'CLOSED'],
        IN_PROGRESS: ['QUOTED', 'CLOSED'],
        QUOTED: ['APPROVED', 'CLOSED'],
        APPROVED: ['CONVERTED_TO_BOOKING', 'CLOSED'],
        CONVERTED_TO_BOOKING: ['CLOSED'],
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

    const followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : undefined;
    if (
      followUpAt &&
      followUpAt.getTime() > Date.now() + 2 * 365 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Follow-up date cannot be more than two years ahead',
      );
    }
    const safeInternalNote =
      dto.internalNote !== undefined
        ? sanitizePlainText(dto.internalNote).slice(0, 5_000)
        : undefined;
    const changedFields = Object.keys(dto);

    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.tailorMadeInquiry.updateMany({
          where: {
            id: inquiry.id,
            status: inquiry.status,
            ...(isAgent && { assigneeId: adminUserId }),
          },
          data: {
            ...(dto.status && { status: dto.status }),
            ...(dto.assigneeId !== undefined && {
              assigneeId: dto.assigneeId,
            }),
            ...(dto.followUpAt !== undefined && {
              followUpAt: followUpAt ?? null,
            }),
            ...(safeInternalNote !== undefined && {
              internalNote: safeInternalNote,
            }),
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Inquiry changed; reload before updating it',
          );
        }
        await tx.auditLog.create({
          data: {
            actorId: adminUserId,
            actorRole: isAgent ? 'AGENT' : 'ADMIN',
            action: 'TAILOR_MADE_INQUIRY_UPDATED',
            entityType: 'TAILOR_MADE_INQUIRY',
            entityId: inquiry.id,
            metadata: { changedFields },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return this.getInquiryByReferenceCode(
      referenceCode,
      adminUserId,
      isAgent,
    );
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
      destination,
      city,
      category,
      market,
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
    const andConditions: any[] = [];

    const targetDest = destination || country;
    if (targetDest && targetDest !== 'ALL') {
      andConditions.push({
        OR: [
          { country: { equals: targetDest, mode: 'insensitive' } },
          { country: { contains: targetDest, mode: 'insensitive' } },
          { city: { contains: targetDest, mode: 'insensitive' } },
          { region: { contains: targetDest, mode: 'insensitive' } },
          { category: { contains: targetDest, mode: 'insensitive' } },
          { slug: { contains: targetDest, mode: 'insensitive' } },
        ],
      });
    }

    if (city && city !== 'ALL') {
      andConditions.push({ city: { contains: city, mode: 'insensitive' } });
    }

    const targetCategory = market || category;
    if (targetCategory && targetCategory !== 'ALL') {
      andConditions.push({
        OR: [
          { category: { contains: targetCategory, mode: 'insensitive' } },
          { tags: { has: targetCategory } },
          { slug: { contains: targetCategory, mode: 'insensitive' } },
        ],
      });
    }

    if (status && status !== 'ALL') {
      andConditions.push({ status });
    }

    if (isFeatured !== undefined) {
      andConditions.push({ isFeatured: isFeatured === 'true' });
    }

    if (tag) {
      andConditions.push({ tags: { has: tag } });
    }

    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { slug: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { country: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
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
    const [totalTours, publishedTours, draftTours, featuredTours, capacityAgg] =
      await Promise.all([
        this.prisma.tour.count({ where: { deletedAt: null } }),
        this.prisma.tour.count({
          where: { deletedAt: null, status: 'PUBLISHED' },
        }),
        this.prisma.tour.count({ where: { deletedAt: null, status: 'DRAFT' } }),
        this.prisma.tour.count({
          where: { deletedAt: null, isFeatured: true },
        }),
        this.prisma.tourAvailability.aggregate({
          _sum: { totalCapacity: true, remainingSeats: true },
        }),
      ]);

    const totalCapacity = capacityAgg._sum?.totalCapacity || 0;
    const totalRemaining = capacityAgg._sum?.remainingSeats || 0;
    const seatsSold = Math.max(0, totalCapacity - totalRemaining);

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
          ? Number(((seatsSold / totalCapacity) * 100).toFixed(1))
          : 0,
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
      ...rows.map((row) =>
        row.map((cell) => this.toCsvCell(cell)).join(','),
      ),
    ].join('\n');
  }

  private toCsvCell(value: unknown): string {
    const safeValue = sanitizeCsvField(value).replace(/"/g, '""');
    return `"${safeValue}"`;
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
        reviews: { orderBy: { createdAt: 'desc' }, take: 500 },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 500 },
        landingPages: {
          include: {
            landingPage: {
              select: { id: true, slug: true, titleJsonb: true, type: true },
            },
          },
        },
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true,
            referenceCode: true,
            userId: true,
            status: true,
            arrivalDate: true,
            departureDate: true,
            arrivalTime: true,
            departureTime: true,
            language: true,
            activityType: true,
            bookingType: true,
            transportChoice: true,
            adults: true,
            children: true,
            infants: true,
            totalAmountUsd: true,
            paidAmountUsd: true,
            notes: true,
            inquiryMessage: true,
            createdAt: true,
            updatedAt: true,
            assigneeId: true,
            companyId: true,
            priority: true,
            tags: true,
            billingInfo: {
              select: { fullName: true, email: true },
            },
          },
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
        paidAmountUsd: b.paidAmountUsd.toString(),
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
    this.assertValidSeasonPricing(dto.seasonPricingJsonb);
    const { itineraries, images, ...tourData } = dto;
    this.assertTourImages(images);
    const safeTourData = this.prepareTourData(tourData, true);
    const safeItineraries = this.prepareTourItineraries(itineraries);
    const safeImages = this.prepareTourImages(images);

    const tour = await this.prisma.tour.create({
      data: {
        ...(safeTourData as Prisma.TourCreateInput),
        itineraries: safeItineraries
          ? {
              create: safeItineraries,
            }
          : undefined,
        images: safeImages
          ? {
              create: safeImages,
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

    await this.invalidateTourCache(tour.slug);
    return { success: true, slug: tour.slug };
  }

  async updateTour(slug: string, dto: UpdateTourDto, adminUserId: string) {
    this.logger.log(
      `updateTour invoked by admin ${adminUserId} for slug: ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);
    this.assertValidSeasonPricing(dto.seasonPricingJsonb);
    const { itineraries, images, ...tourData } = dto;
    this.assertTourImages(images);
    const safeTourData = this.prepareTourData(tourData, false);
    const safeItineraries = this.prepareTourItineraries(itineraries);
    const safeImages = this.prepareTourImages(images);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (safeItineraries) {
        await tx.tourItinerary.deleteMany({
          where: { tourId: tour.id },
        });
        await tx.tourItinerary.createMany({
          data: safeItineraries.map((it) => ({
            tourId: tour.id,
            ...it,
          })),
        });
      }

      if (safeImages) {
        await tx.tourImage.deleteMany({ where: { tourId: tour.id } });
        await tx.tourImage.createMany({
          data: safeImages.map((img) => ({
            tourId: tour.id,
            ...img,
          })),
        });
      }

      return tx.tour.update({
        where: { slug },
        data: {
          ...(safeTourData as Prisma.TourUpdateInput),
          activityLogs: {
            create: [
              {
                userId: adminUserId,
                action: 'TOUR_UPDATED',
                details: {
                  changedFields: Object.keys(tourData),
                  itinerariesReplaced: Boolean(itineraries),
                  imagesReplaced: Boolean(images),
                },
              },
            ],
          },
        },
      });
    });

    // Invalidate detail and catalog cache
    await this.invalidateTourCache(slug);

    return { success: true, slug: updated.slug };
  }

  private assertValidSeasonPricing(
    rules?: Array<{
      startDate: string;
      endDate: string;
      multiplier: number;
    }>,
  ): void {
    if (!rules) return;
    const normalized = rules
      .map((rule) => ({
        start: new Date(rule.startDate).getTime(),
        end: new Date(rule.endDate).getTime(),
        multiplier: rule.multiplier,
      }))
      .sort((a, b) => a.start - b.start);

    for (let index = 0; index < normalized.length; index++) {
      const rule = normalized[index];
      if (
        !Number.isFinite(rule.start) ||
        !Number.isFinite(rule.end) ||
        !Number.isFinite(rule.multiplier) ||
        rule.start > rule.end ||
        rule.multiplier < 0.5 ||
        rule.multiplier > 5 ||
        (index > 0 && rule.start <= normalized[index - 1].end)
      ) {
        throw new BadRequestException(
          'Seasonal pricing rules are invalid or overlapping',
        );
      }
    }
  }

  private assertTourImages(images?: CreateTourDto['images']): void {
    if (!images) return;
    if (images.filter((image) => image.isHero).length > 1) {
      throw new BadRequestException('A tour can only have one hero image');
    }
  }

  private prepareTourData(
    data: Partial<CreateTourDto>,
    isCreate: boolean,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };

    // Fallback/alias mappings for frontend compatibility
    if (data.descriptionJsonb && !data.overviewJsonb) {
      result.overviewJsonb = data.descriptionJsonb;
    }
    if (data.inclusionJsonb && !data.includedServicesJsonb) {
      result.includedServicesJsonb = data.inclusionJsonb;
    }
    if (data.exclusionJsonb && !data.excludedServicesJsonb) {
      result.excludedServicesJsonb = data.exclusionJsonb;
    }
    if (data.importantNotesJsonb && !data.termsJsonb) {
      result.termsJsonb = data.importantNotesJsonb;
    }

    const plainStrings = [
      'category',
      'country',
      'city',
      'region',
      'meetingPoint',
      'departureTime',
      'returnTime',
      'difficultyLevel',
      'ageRestrictions',
      'seoTitle',
      'seoDescription',
    ] as const;
    for (const key of plainStrings) {
      const value = data[key];
      if (typeof value === 'string') {
        result[key] = sanitizePlainText(value);
      }
    }
    if (typeof data.slug === 'string') {
      result.slug = data.slug.toLowerCase();
    }
    if (data.tags) {
      result.tags = [
        ...new Set(
          data.tags
            .map((tag) => sanitizePlainText(tag).slice(0, 50))
            .filter(Boolean),
        ),
      ];
    }
    if (data.languages) {
      result.languages = [...new Set(data.languages)];
    }

    const plainJsonFields = [
      'titleJsonb',
      'durationJsonb',
      'minPaxJsonb',
      'pickupLocationsJsonb',
    ] as const;
    const richJsonFields = [
      'overviewJsonb',
      'includedServicesJsonb',
      'excludedServicesJsonb',
      'hotelInfoJsonb',
      'transportationJsonb',
      'cancellationPolicyJsonb',
      'termsJsonb',
    ] as const;
    for (const key of plainJsonFields) {
      if (result[key] !== undefined && result[key] !== null) {
        result[key] = this.sanitizeTourLocalizedJson(
          result[key],
          key,
          false,
          key === 'titleJsonb',
        );
      }
    }
    for (const key of richJsonFields) {
      if (result[key] !== undefined && result[key] !== null) {
        result[key] = this.sanitizeTourLocalizedJson(
          result[key],
          key,
          true,
        );
      }
    }

    if (isCreate) {
      const status = data.status ?? 'DRAFT';
      result.status = status;
      result.isActive = status === 'PUBLISHED' && data.isActive === true;
      result.currency = 'USD';
    } else if (data.status && data.status !== 'PUBLISHED') {
      result.isActive = false;
    }

    // Strip non-Prisma Tour model fields so Prisma update does not fail
    const nonPrismaKeys = [
      'capacity',
      'minParticipants',
      'maxParticipants',
      'remainingSeats',
      'subtitleJsonb',
      'descriptionJsonb',
      'highlightJsonb',
      'inclusionJsonb',
      'exclusionJsonb',
      'importantNotesJsonb',
      'operatingDaysJsonb',
      'latitude',
      'longitude',
      'itineraries',
      'images',
    ];
    for (const key of nonPrismaKeys) {
      delete result[key];
    }

    return result;
  }

  private prepareTourItineraries(
    itineraries?: CreateTourDto['itineraries'],
  ) {
    if (!itineraries) return undefined;
    return itineraries.map((itinerary) => ({
      dayLabel: itinerary.dayLabel
        ? sanitizePlainText(itinerary.dayLabel).slice(0, 255)
        : undefined,
      descriptionJsonb: this.sanitizeTourLocalizedJson(
        itinerary.descriptionJsonb,
        'itinerary.descriptionJsonb',
        true,
        true,
      ),
      mealsJsonb: itinerary.mealsJsonb && Object.keys(itinerary.mealsJsonb).length > 0
        ? this.sanitizeTourLocalizedJson(
            itinerary.mealsJsonb,
            'itinerary.mealsJsonb',
            true,
          )
        : undefined,
      activitiesJsonb: itinerary.activitiesJsonb && Object.keys(itinerary.activitiesJsonb).length > 0
        ? this.sanitizeTourLocalizedJson(
            itinerary.activitiesJsonb,
            'itinerary.activitiesJsonb',
            true,
          )
        : undefined,
      hotelsJsonb: itinerary.hotelsJsonb && Object.keys(itinerary.hotelsJsonb).length > 0
        ? this.sanitizeTourLocalizedJson(
            itinerary.hotelsJsonb,
            'itinerary.hotelsJsonb',
            true,
          )
        : undefined,
      transportationJsonb: itinerary.transportationJsonb && Object.keys(itinerary.transportationJsonb).length > 0
        ? this.sanitizeTourLocalizedJson(
            itinerary.transportationJsonb,
            'itinerary.transportationJsonb',
            true,
          )
        : undefined,
      notesJsonb: itinerary.notesJsonb && Object.keys(itinerary.notesJsonb).length > 0
        ? this.sanitizeTourLocalizedJson(
            itinerary.notesJsonb,
            'itinerary.notesJsonb',
            false,
          )
        : undefined,
      sortOrder: itinerary.sortOrder ?? 1,
    }));
  }

  private prepareTourImages(images?: CreateTourDto['images']) {
    if (!images) return undefined;
    return images.map((image) => ({
      imageUrl: image.imageUrl,
      isHero: Boolean(image.isHero),
      isVideo: Boolean(image.isVideo),
      videoUrl: image.videoUrl && String(image.videoUrl).trim().length > 0
        ? String(image.videoUrl).trim()
        : null,
      altText: image.altText
        ? sanitizePlainText(image.altText).slice(0, 255)
        : null,
      sortOrder: image.sortOrder ?? 1,
    }));
  }

  private sanitizeTourLocalizedJson(
    value: unknown,
    fieldName: string,
    richText: boolean,
    requireEnglish = false,
  ): Prisma.InputJsonValue {
    if (value === null || value === undefined) {
      if (requireEnglish) {
        throw new BadRequestException(`${fieldName}.en is required`);
      }
      return {};
    }

    // If it's a primitive string, wrap in { en: string }
    if (typeof value === 'string') {
      const sanitized = (
        richText ? sanitizeHtmlContent(value) : sanitizePlainText(value)
      ).slice(0, 20_000);
      return { en: sanitized };
    }

    // If it's an array, sanitize each item
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          return (
            richText ? sanitizeHtmlContent(item) : sanitizePlainText(item)
          ).slice(0, 20_000);
        }
        if (typeof item === 'object' && item !== null) {
          return this.sanitizeTourLocalizedJson(
            item,
            `${fieldName}[]`,
            richText,
            false,
          );
        }
        return item;
      }) as Prisma.InputJsonValue;
    }

    // If it's an object
    if (typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (val === null || val === undefined) continue;
        if (typeof val === 'string') {
          result[key] = (
            richText ? sanitizeHtmlContent(val) : sanitizePlainText(val)
          ).slice(0, 20_000);
        } else if (Array.isArray(val)) {
          result[key] = val.map((v) =>
            typeof v === 'string'
              ? (
                  richText ? sanitizeHtmlContent(v) : sanitizePlainText(v)
                ).slice(0, 20_000)
              : v,
          );
        } else if (typeof val === 'object') {
          result[key] = val;
        } else {
          result[key] = val;
        }
      }

      if (
        requireEnglish &&
        (!result.en || (typeof result.en === 'string' && !result.en.trim()))
      ) {
        const firstVal = Object.values(result)[0];
        if (typeof firstVal === 'string' && firstVal.trim()) {
          result.en = firstVal;
        } else if (!result.en) {
          throw new BadRequestException(`${fieldName}.en is required`);
        }
      }

      return result as Prisma.InputJsonValue;
    }

    return {};
  }

  async bulkUpdateTours(dto: BulkUpdateToursDto, adminUserId: string) {
    this.logger.log(`bulkUpdateTours invoked by admin ${adminUserId}`);
    if (
      dto.isActive === true &&
      dto.status !== undefined &&
      dto.status !== 'PUBLISHED'
    ) {
      throw new BadRequestException(
        'Only published tours can be activated',
      );
    }
    if (dto.isActive === true && dto.status === undefined) {
      throw new BadRequestException(
        'Bulk activation requires status PUBLISHED',
      );
    }
    const data: Prisma.TourUpdateManyMutationInput = {};
    if (dto.status) data.status = dto.status;
    if (dto.category) {
      data.category = sanitizePlainText(dto.category).slice(0, 100);
    }
    if (dto.country) {
      data.country = sanitizePlainText(dto.country).slice(0, 100);
    }
    if (dto.status && dto.status !== 'PUBLISHED') {
      data.isActive = false;
    } else if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) return { count: 0 };
    const { result, tours } = await this.prisma.$transaction(
      async (tx) => {
        const targets = await tx.tour.findMany({
          where: { slug: { in: dto.slugs }, deletedAt: null },
          select: { id: true, slug: true },
        });
        if (targets.length !== dto.slugs.length) {
          throw new BadRequestException(
            'One or more tours are invalid or deleted',
          );
        }
        const updated = await tx.tour.updateMany({
          where: { slug: { in: dto.slugs }, deletedAt: null },
          data,
        });
        await tx.tourActivityLog.createMany({
          data: targets.map((tour) => ({
            tourId: tour.id,
            userId: adminUserId,
            action: 'BULK_UPDATE',
            details: { changedFields: Object.keys(data) },
          })),
        });
        return { result: updated, tours: targets };
      },
      { isolationLevel: 'Serializable' },
    );

    for (const t of tours) {
      await this.invalidateTourCache(t.slug);
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
        isActive: false,
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

    await this.invalidateTourCache(slug);

    return { success: true };
  }

  async suspendUser(userId: string, reason: string, adminUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        suspendedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (userId === adminUserId) {
      throw new ForbiddenException('You cannot suspend your own account');
    }
    const safeReason = sanitizePlainText(reason).slice(0, 500);
    return this.prisma.$transaction(
      async (tx) => {
        if (user.role === 'SUPER_ADMIN') {
          const activeSuperAdmins = await tx.user.count({
            where: {
              role: 'SUPER_ADMIN',
              deletedAt: null,
              suspendedAt: null,
              status: 'ACTIVE',
            },
          });
          if (activeSuperAdmins <= 1) {
            throw new ForbiddenException(
              'The last active SUPER_ADMIN cannot be suspended',
            );
          }
        }
        const updated = await tx.user.update({
          where: { id: userId },
          data: {
            suspendedAt: new Date(),
            suspendReason: safeReason,
            refreshToken: null,
            sessionVersion: { increment: 1 },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            suspendedAt: true,
            suspendReason: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminUserId,
            actorRole: 'SUPER_ADMIN',
            action: 'USER_SUSPENDED',
            entityType: 'USER',
            entityId: userId,
            metadata: { reason: safeReason },
          },
        });
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async activateUser(userId: string, adminUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: null, suspendReason: null },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          suspendedAt: true,
          suspendReason: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: 'SUPER_ADMIN',
          action: 'USER_ACTIVATED',
          entityType: 'USER',
          entityId: userId,
        },
      });
      return updated;
    });
  }

  async addTourImage(
    slug: string,
    dto: AddTourImageDto,
    adminUserId: string,
  ) {
    this.logger.log(`Admin ${adminUserId} adding image to tour ${slug}`);
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const image = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.findFirst({
        where: {
          publicId: dto.publicId,
          secureUrl: dto.url,
          entityType: MediaEntityType.TOUR,
          entityId: tour.id,
          uploadedBy: adminUserId,
          mimeType: { startsWith: 'image/' },
          deletedAt: null,
        },
        select: { secureUrl: true, altText: true },
      });
      if (!asset) {
        throw new BadRequestException(
          'Image must be an active tour asset uploaded by this admin',
        );
      }
      if (dto.isHero) {
        await tx.tourImage.updateMany({
          where: { tourId: tour.id, isHero: true },
          data: { isHero: false },
        });
      }
      const image = await tx.tourImage.create({
        data: {
          tourId: tour.id,
          imageUrl: asset.secureUrl,
          altText: asset.altText,
          isHero: dto.isHero,
          sortOrder: dto.sortOrder,
        },
      });
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_IMAGE_ADDED',
          details: { imageId: image.id, isHero: image.isHero },
        },
      });
      return image;
    });
    await this.invalidateTourCache(slug);
    return image;
  }

  async removeTourImage(slug: string, imageId: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} removing image ${imageId} from tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.tourImage.deleteMany({
        where: { id: imageId, tourId: tour.id },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Tour image not found');
      }
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_IMAGE_REMOVED',
          details: { imageId },
        },
      });
    });
    await this.invalidateTourCache(slug);
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

    const image = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.tourImage.updateMany({
        where: { id: imageId, tourId: tour.id },
        data: { sortOrder },
      });
      if (changed.count !== 1) {
        throw new NotFoundException('Tour image not found');
      }
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_IMAGE_REORDERED',
          details: { imageId, sortOrder },
        },
      });
      return tx.tourImage.findUniqueOrThrow({ where: { id: imageId } });
    });
    await this.invalidateTourCache(slug);
    return image;
  }

  async addTourItinerary(
    slug: string,
    dto: AddTourItineraryDto,
    adminUserId: string,
  ) {
    this.logger.log(
      `Admin ${adminUserId} adding itinerary day to tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const itinerary = await this.prisma.$transaction(async (tx) => {
      const itinerary = await tx.tourItinerary.create({
        data: {
          tourId: tour.id,
          dayLabel: sanitizePlainText(dto.dayLabel).slice(0, 50),
          descriptionJsonb: this.sanitizeTourLocalizedJson(
            dto.descriptionJsonb,
            'descriptionJsonb',
            true,
            true,
          ),
          mealsJsonb: dto.mealsJsonb
            ? this.sanitizeTourLocalizedJson(
                dto.mealsJsonb,
                'mealsJsonb',
                true,
              )
            : Prisma.JsonNull,
          sortOrder: dto.sortOrder,
        },
      });
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_ITINERARY_ADDED',
          details: { itineraryId: itinerary.id },
        },
      });
      return itinerary;
    });
    await this.invalidateTourCache(slug);
    return itinerary;
  }

  async updateTourItinerary(
    slug: string,
    dayId: string,
    dto: UpdateTourItineraryDto,
    adminUserId: string,
  ) {
    this.logger.log(
      `Admin ${adminUserId} updating itinerary ${dayId} on tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const itinerary = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.tourItinerary.updateMany({
        where: { id: dayId, tourId: tour.id },
        data: {
          ...(dto.dayLabel && {
            dayLabel: sanitizePlainText(dto.dayLabel).slice(0, 50),
          }),
          ...(dto.descriptionJsonb && {
            descriptionJsonb: this.sanitizeTourLocalizedJson(
              dto.descriptionJsonb,
              'descriptionJsonb',
              true,
              true,
            ),
          }),
          ...(dto.mealsJsonb && {
            mealsJsonb: this.sanitizeTourLocalizedJson(
              dto.mealsJsonb,
              'mealsJsonb',
              true,
            ),
          }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
      if (changed.count !== 1) {
        throw new NotFoundException('Tour itinerary not found');
      }
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_ITINERARY_UPDATED',
          details: {
            itineraryId: dayId,
            changedFields: Object.keys(dto),
          },
        },
      });
      return tx.tourItinerary.findUniqueOrThrow({ where: { id: dayId } });
    });
    await this.invalidateTourCache(slug);
    return itinerary;
  }

  async removeTourItinerary(slug: string, dayId: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} removing itinerary ${dayId} from tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.tourItinerary.deleteMany({
        where: { id: dayId, tourId: tour.id },
      });
      if (deleted.count !== 1) {
        throw new NotFoundException('Tour itinerary not found');
      }
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_ITINERARY_REMOVED',
          details: { itineraryId: dayId },
        },
      });
    });
    await this.invalidateTourCache(slug);
    return { message: 'Itinerary deleted' };
  }

  private async invalidateTourCache(slug?: string): Promise<void> {
    if (slug) {
      for (const locale of ['en', 'es', 'pt', 'it', 'ar']) {
        await this.cacheManager.del(`tour:${slug}:${locale}`);
      }
    }
    try {
      const currentV =
        (await this.cacheManager.get<number>('tours:catalog:v')) || 1;
      await this.cacheManager.set('tours:catalog:v', currentV + 1, 86400000);
    } catch (err) {
      this.logger.warn(
        `Failed to bump tours catalog cache version: ${(err as any)?.message}`,
      );
    }
  }
}
