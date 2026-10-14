import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PAYMENT_EVENTS } from '../../common/events/payment-events';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../../common/cache/cache.service';
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
import { CreateTourDto, TripAccommodationDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { MoveTourDto } from './dto/move-tour.dto';
import { ReorderToursDto } from './dto/reorder-tours.dto';
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
import { generateReferenceCode } from '../../common/utils';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly bookingsService: BookingsService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly cacheService?: CacheService,
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
    const limit =
      query.limit && Number(query.limit) > 0 ? Number(query.limit) : 20;
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
          billingInfo: {
            select: {
              fullName: true,
              email: true,
              phone: true,
              country: true,
              city: true,
            },
          },
          user: { select: { id: true, name: true, email: true } },
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
        paidAmount: b.paidAmountUsd?.toString() || '0.00',
        currency: 'USD',
        passengerCount: b._count.passengers,
        adults: b.adults,
        children: b.children,
        infants: b.infants,
        tourId: b.tour.id,
        tourSlug: b.tour.slug,
        tourNameEn,
        invoiceNumber: b.invoice?.invoiceNumber || null,
        arrivalDate: b.arrivalDate,
        departureDate: b.departureDate,
        transportChoice: b.transportChoice,
        language: b.language,
        bookingType: b.bookingType,
        priority: b.priority,
        billingInfo: b.billingInfo
          ? {
              fullName: b.billingInfo.fullName,
              email: b.billingInfo.email,
              phone: b.billingInfo.phone || null,
              country: b.billingInfo.country || null,
              city: b.billingInfo.city || null,
            }
          : null,
        user: b.user
          ? {
              id: b.user.id,
              name: b.user.name,
              email: b.user.email,
            }
          : null,
        createdAt: b.createdAt,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tour: {
          select: {
            id: true,
            slug: true,
            titleJsonb: true,
            subtitleJsonb: true,
            category: true,
            country: true,
            city: true,
            basePriceUsd: true,
            durationJsonb: true,
          },
        },
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
      paidAmount: b.paidAmountUsd?.toString() || '0.00',
      currency: 'USD',
      passengerCount: b.passengers.length,
      adults: b.adults,
      children: b.children,
      infants: b.infants,
      tourId: b.tour.id,
      tourSlug: b.tour.slug,
      tourNameEn,
      invoiceNumber: b.invoice?.invoiceNumber || null,
      arrivalDate: b.arrivalDate,
      departureDate: b.departureDate,
      arrivalTime: b.arrivalTime,
      departureTime: b.departureTime,
      language: b.language,
      activityType: b.activityType,
      bookingType: b.bookingType,
      transportChoice: b.transportChoice,
      notes: b.notes,
      inquiryMessage: b.inquiryMessage,
      priority: b.priority,
      tags: b.tags,
      cancellationReason: b.cancellationReason,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      tour: {
        id: b.tour.id,
        slug: b.tour.slug,
        titleJsonb: b.tour.titleJsonb,
        subtitleJsonb: b.tour.subtitleJsonb,
        category: b.tour.category,
        country: b.tour.country,
        city: b.tour.city,
        basePriceUsd: b.tour.basePriceUsd?.toString(),
        durationJsonb: b.tour.durationJsonb,
      },
      user: b.user
        ? {
            id: b.user.id,
            name: b.user.name,
            email: b.user.email,
            phone: b.user.phone || null,
            role: b.user.role,
          }
        : null,
      assignee: b.assignee
        ? {
            id: b.assignee.id,
            name: b.assignee.name,
            email: b.assignee.email,
          }
        : null,
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
            invoiceType: b.billingInfo.invoiceType,
            companyName: b.billingInfo.companyName || null,
            taxId: b.billingInfo.taxId || null,
            address: b.billingInfo.address || null,
            city: b.billingInfo.city || null,
            country: b.billingInfo.country || null,
          }
        : null,
      invoice: b.invoice
        ? {
            id: b.invoice.id,
            invoiceNumber: b.invoice.invoiceNumber,
            status: b.invoice.status,
            subtotal: b.invoice.subtotal?.toString(),
            tax: b.invoice.tax?.toString(),
            total: b.invoice.total?.toString(),
            currency: b.invoice.currency,
            dueDate: b.invoice.dueDate || null,
            pdfUrl: b.invoice.pdfUrl || null,
            createdAt: b.invoice.issuedAt,
          }
        : null,
      payments: b.payments,
      activityLogs: b.activityLogs,
      notesList: b.notesList,
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
            cancellationReason: sanitizePlainText(dto.cancellationReason).slice(
              0,
              2_000,
            ),
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

  async cancelWithRefund(
    referenceCode: string,
    adminUserId: string,
    role: string,
    reason?: string,
  ) {
    return this.bookingsService.cancelWithRefund(
      referenceCode,
      { id: adminUserId, role },
      reason,
    );
  }

  async recordManualBookingPayment(
    referenceCode: string,
    dto: {
      amount: number;
      method?: string;
      transactionId?: string;
      notes?: string;
    },
    adminUserId: string,
  ) {
    const amountNum = Number(dto.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    const paymentAmount = new Prisma.Decimal(amountNum.toFixed(2));

    const result = await this.prisma.$transaction(async (tx) => {
      const [lockedBooking] = await tx.$queryRaw<any[]>`
        SELECT id, "total_amount_usd" AS "totalAmountUsd", "paid_amount_usd" AS "paidAmountUsd", status
        FROM bookings
        WHERE reference_code = ${referenceCode} AND deleted_at IS NULL
        FOR UPDATE
      `;

      if (!lockedBooking) throw new NotFoundException('Booking not found');

      if (
        ['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(lockedBooking.status)
      ) {
        throw new BadRequestException(
          `Cannot record a payment for a booking with status ${lockedBooking.status}`,
        );
      }

      const total = new Prisma.Decimal(lockedBooking.totalAmountUsd);
      const paid = new Prisma.Decimal(lockedBooking.paidAmountUsd ?? 0);
      const newPaidAmount = paid.plus(paymentAmount);

      if (newPaidAmount.gt(total)) {
        throw new BadRequestException(
          `Total paid amount ($${newPaidAmount.toFixed(2)}) cannot exceed booking total ($${total.toFixed(2)})`,
        );
      }

      const isFullyPaid = newPaidAmount.equals(total);
      const targetStatus = isFullyPaid ? 'CONFIRMED' : 'PARTIALLY_PAID';

      const payment = await tx.payment.create({
        data: {
          bookingId: lockedBooking.id,
          amount: paymentAmount,
          currency: 'USD',
          method: dto.method || 'CASH',
          provider: 'MANUAL_ADMIN',
          providerStatus: 'PAID',
          transactionId: dto.transactionId || `MANUAL-${Date.now()}`,
          status: 'CAPTURED',
          paidAt: new Date(),
        },
      });

      await tx.booking.update({
        where: { id: lockedBooking.id },
        data: {
          status: targetStatus,
          paidAmountUsd: newPaidAmount,
        },
      });

      const invoice = await tx.invoice.findUnique({
        where: { bookingId: lockedBooking.id },
      });

      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: isFullyPaid ? 'PAID' : 'SENT',
            paymentId: payment.id,
          },
        });
      }

      await tx.bookingActivityLog.create({
        data: {
          bookingId: lockedBooking.id,
          userId: adminUserId,
          action: 'MANUAL_PAYMENT_RECORDED',
          details: {
            amount: paymentAmount.toFixed(2),
            method: dto.method || 'CASH',
            transactionId: dto.transactionId || payment.transactionId,
            newPaidTotal: newPaidAmount.toFixed(2),
            newStatus: targetStatus,
            notes: dto.notes || null,
          },
        },
      });

      return {
        success: true,
        payment,
        newPaidAmount: newPaidAmount.toFixed(2),
        balanceDue: total.minus(newPaidAmount).toFixed(2),
        status: targetStatus,
        bookingId: lockedBooking.id,
      };
    });

    if (this.eventEmitter) {
      this.eventEmitter.emit(PAYMENT_EVENTS.SUCCEEDED, {
        paymentId: result.payment.id,
        bookingId: result.bookingId,
        amountUsd: paymentAmount.toNumber(),
        transactionId: result.payment.transactionId,
        gateway: 'MANUAL_ADMIN',
      });
    }

    const { bookingId: _bId, ...response } = result;
    return response;
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
      ...rows.map((row) => row.map((cell) => this.toCsvCell(cell)).join(',')),
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
      search,
    } = query;
    this.logger.log(`listInquiries invoked by admin ${adminUserId}`);

    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (assigneeId) where.assigneeId = assigneeId;
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { referenceCode: { contains: term, mode: 'insensitive' } },
        { fullName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { partnerCode: { contains: term, mode: 'insensitive' } },
      ];
    }
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
        include: {
          company: {
            select: {
              id: true,
              name: true,
              referenceCode: true,
              taxId: true,
              tier: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const data: IAdminInquirySummary[] = records.map((r) => {
      const parts = r.fullName.split(' ');
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || '';
      return {
        id: r.id,
        referenceCode: r.referenceCode,
        status: r.status,
        fullName: r.fullName,
        firstName,
        lastName,
        email: r.email,
        phone: r.phone || null,
        destinations: r.destinations,
        departureDate: r.startDate || null,
        returnDate: r.endDate || null,
        adults: r.adults,
        children: r.children,
        numberOfTravelers: r.adults + r.children,
        budgetAmount: r.budgetAmount ? Number(r.budgetAmount) : null,
        budgetCurrency: r.budgetCurrency || 'USD',
        quotedAmountUsd: r.quotedAmountUsd ? Number(r.quotedAmountUsd) : null,
        notes: r.notes || null,
        partnerCode: r.partnerCode || null,
        companyId: r.companyId || null,
        company: r.company,
        assigneeId: r.assigneeId,
        assignee: r.assignee,
        bookingId: r.bookingId || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getInquiryMetrics(adminUserId: string, isAgent: boolean = false) {
    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (isAgent) {
      where.assigneeId = adminUserId;
    }

    const [
      total,
      newlyReceived,
      inProgress,
      quoted,
      approved,
      converted,
      closed,
      activeInquiries,
    ] = await Promise.all([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'NEWLY_RECEIVED' },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'IN_PROGRESS' },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'QUOTED' },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'APPROVED' },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'CONVERTED_TO_BOOKING' },
      }),
      this.prisma.tailorMadeInquiry.count({
        where: { ...where, status: 'CLOSED' },
      }),
      this.prisma.tailorMadeInquiry.findMany({
        where: { ...where, status: { notIn: ['CLOSED'] } },
        select: { quotedAmountUsd: true, budgetAmount: true },
      }),
    ]);

    const pipelineValue = activeInquiries.reduce((acc, curr) => {
      const val = curr.quotedAmountUsd
        ? Number(curr.quotedAmountUsd)
        : curr.budgetAmount
          ? Number(curr.budgetAmount)
          : 0;
      return acc + val;
    }, 0);

    return {
      total,
      newlyReceived,
      inProgress,
      quoted,
      approved,
      converted,
      closed,
      pipelineValue,
    };
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
      include: {
        company: {
          select: {
            id: true,
            name: true,
            referenceCode: true,
            taxId: true,
            tier: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            referenceCode: true,
            status: true,
            totalAmountUsd: true,
          },
        },
      },
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
      fullName: r.fullName,
      firstName,
      lastName,
      email: r.email,
      phone: r.phone || null,
      destinations: r.destinations,
      departureDate: r.startDate || null,
      returnDate: r.endDate || null,
      adults: r.adults,
      children: r.children,
      numberOfTravelers: r.adults + r.children,
      budgetAmount: r.budgetAmount ? Number(r.budgetAmount) : null,
      budgetCurrency: r.budgetCurrency || 'USD',
      quotedAmountUsd: r.quotedAmountUsd ? Number(r.quotedAmountUsd) : null,
      notes: r.notes || null,
      partnerCode: r.partnerCode || null,
      companyId: r.companyId || null,
      company: r.company,
      message: r.notes || null,
      budget,
      locale: r.preferredLanguage,
      ipAddress: null,
      followUpAt: r.followUpAt,
      internalNote: r.internalNote,
      assigneeId: r.assigneeId,
      assignee: r.assignee,
      bookingId: r.bookingId || null,
      createdAt: r.createdAt,
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
          role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException(
          'Assignee must be an active agent or admin',
        );
      }
    }

    if (dto.status && inquiry.status !== dto.status) {
      // CONVERTED_TO_BOOKING may ONLY be set via the dedicated /convert-to-booking endpoint
      // which creates the actual booking + invoice. Setting it directly corrupts data.
      if (dto.status === 'CONVERTED_TO_BOOKING') {
        throw new BadRequestException(
          'Cannot set status to CONVERTED_TO_BOOKING directly. Use the Convert to Booking action instead.',
        );
      }

      const validTransitions: Record<string, string[]> = {
        NEWLY_RECEIVED: ['IN_PROGRESS', 'QUOTED', 'APPROVED', 'CLOSED'],
        IN_PROGRESS: ['QUOTED', 'APPROVED', 'CLOSED', 'NEWLY_RECEIVED'],
        QUOTED: ['APPROVED', 'IN_PROGRESS', 'CLOSED', 'NEWLY_RECEIVED'],
        APPROVED: ['QUOTED', 'IN_PROGRESS', 'CLOSED'],
        CONVERTED_TO_BOOKING: [
          'CLOSED',
          'APPROVED', // Admin can revert a mis-converted inquiry back to APPROVED
        ],
        CLOSED: ['IN_PROGRESS', 'NEWLY_RECEIVED', 'QUOTED'],
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

    const safeNotes =
      dto.notes !== undefined
        ? sanitizePlainText(dto.notes).slice(0, 5_000)
        : undefined;

    const quotedAmountDecimal =
      dto.quotedAmountUsd !== undefined
        ? new Prisma.Decimal(Number(dto.quotedAmountUsd).toFixed(2))
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
              assigneeId: dto.assigneeId || null,
            }),
            ...(dto.followUpAt !== undefined && {
              followUpAt: followUpAt ?? null,
            }),
            ...(safeInternalNote !== undefined && {
              internalNote: safeInternalNote,
            }),
            ...(safeNotes !== undefined && {
              notes: safeNotes,
            }),
            ...(quotedAmountDecimal !== undefined && {
              quotedAmountUsd: quotedAmountDecimal,
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

    return this.getInquiryByReferenceCode(referenceCode, adminUserId, isAgent);
  }

  async convertInquiryToBooking(
    referenceCode: string,
    adminUserId: string,
    dto?: {
      tourId?: string;
      quotedAmountUsd?: number;
      notes?: string;
    },
  ) {
    const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
      where: { referenceCode },
      include: { company: true },
    });
    if (!inquiry) {
      throw new NotFoundException(
        `Inquiry with reference ${referenceCode} not found`,
      );
    }

    if (inquiry.bookingId) {
      const existingBooking = await this.prisma.booking.findUnique({
        where: { id: inquiry.bookingId },
      });
      if (existingBooking) {
        return {
          success: true,
          message: 'Inquiry is already converted to booking',
          booking: existingBooking,
        };
      }
    }

    // Status guard: only APPROVED inquiries can be converted
    if (inquiry.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only APPROVED inquiries can be converted to a booking. Current status: ${inquiry.status}`,
      );
    }

    // Determine total amount
    const totalAmount = dto?.quotedAmountUsd
      ? new Prisma.Decimal(Number(dto.quotedAmountUsd).toFixed(2))
      : inquiry.quotedAmountUsd ||
        inquiry.budgetAmount ||
        new Prisma.Decimal(1500.0);

    // Find tour (or default to first active tour)
    let tourId = dto?.tourId;
    if (!tourId) {
      const firstTour = await this.prisma.tour.findFirst({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (firstTour) tourId = firstTour.id;
    }
    if (!tourId) {
      throw new BadRequestException(
        'No active tour available to associate with booking',
      );
    }

    // Determine or find customer User
    const customerUser = await this.prisma.user.findFirst({
      where: { email: inquiry.email.toLowerCase(), deletedAt: null },
      select: { id: true, email: true },
    });

    const bookingRef = generateReferenceCode('DN');

    return this.prisma.$transaction(async (tx) => {
      const arrivalDate = inquiry.startDate
        ? inquiry.startDate.toISOString().split('T')[0]
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

      const departureDate = inquiry.endDate
        ? inquiry.endDate.toISOString().split('T')[0]
        : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

      const newBooking = await tx.booking.create({
        data: {
          referenceCode: bookingRef,
          userId: customerUser ? customerUser.id : null,
          tourId: tourId!,
          companyId: inquiry.companyId || null,
          status: 'PENDING',
          totalAmountUsd: totalAmount,
          adults: inquiry.adults,
          children: inquiry.children,
          infants: 0,
          arrivalDate: new Date(arrivalDate),
          departureDate: new Date(departureDate),
          notes: [
            `Guest: ${inquiry.fullName} (${inquiry.email} | ${inquiry.phone})`,
            inquiry.notes ? `Inquiry Notes: ${inquiry.notes}` : '',
            dto?.notes ? `Admin Notes: ${dto.notes}` : '',
            `Converted from Tailor-Made Inquiry ${inquiry.referenceCode}`,
          ]
            .filter(Boolean)
            .join(' | '),
          assigneeId: inquiry.assigneeId || adminUserId,
          billingInfo: {
            create: {
              fullName: inquiry.fullName,
              email: inquiry.email.toLowerCase(),
              phone: inquiry.phone,
              invoiceType: 'PERSONAL',
            },
          },
          passengers: {
            create: {
              fullName: inquiry.fullName,
              passengerType: 'ADULT',
            },
          },
        },
      });

      // Update inquiry to CONVERTED_TO_BOOKING and link bookingId
      await tx.tailorMadeInquiry.update({
        where: { id: inquiry.id },
        data: {
          bookingId: newBooking.id,
          status: 'CONVERTED_TO_BOOKING',
          quotedAmountUsd: totalAmount,
        },
      });

      // Create initial Invoice
      const invoiceNumber = `INV-${bookingRef}`;
      const tourTitle = `Tailor-Made Itinerary: ${
        Array.isArray(inquiry.destinations)
          ? inquiry.destinations.join(', ')
          : (inquiry.destinations ?? 'Custom Egypt Experience')
      }`;
      const snapshotJsonb = {
        version: 1,
        invoiceNumber,
        bookingReference: newBooking.referenceCode ?? bookingRef,
        issuedAt: new Date().toISOString(),
        tourTitle,
        tourSlug: 'tailor-made',
        arrivalDate: inquiry.startDate
          ? new Date(inquiry.startDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        departureDate: inquiry.endDate
          ? new Date(inquiry.endDate).toISOString().split('T')[0]
          : null,
        adults: inquiry.adults ?? 1,
        children: inquiry.children ?? 0,
        infants: 0,
        customer: {
          name: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone ?? null,
        },
        billingRecipient: {
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone ?? '',
          invoiceType: 'PERSONAL',
          companyName: null,
          taxId: null,
          address: null,
          city: null,
          country: null,
        },
        items: [
          {
            description: tourTitle,
            quantity: 1,
            unitPrice: Number(totalAmount),
            totalPrice: Number(totalAmount),
          },
        ],
        subtotal: Number(totalAmount),
        tax: 0,
        total: Number(totalAmount),
        currency: 'USD',
      };

      await tx.invoice.create({
        data: {
          bookingId: newBooking.id,
          invoiceNumber,
          status: 'SENT',
          subtotal: totalAmount,
          total: totalAmount,
          currency: 'USD',
          snapshotJsonb: snapshotJsonb as unknown as Prisma.InputJsonValue,
        },
      });

      // Create activity log
      await tx.bookingActivityLog.create({
        data: {
          bookingId: newBooking.id,
          userId: adminUserId,
          action: 'CREATED_FROM_INQUIRY',
          details: {
            inquiryReferenceCode: inquiry.referenceCode,
            totalAmount: totalAmount.toFixed(2),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminUserId,
          actorRole: 'ADMIN',
          action: 'INQUIRY_CONVERTED_TO_BOOKING',
          entityType: 'TAILOR_MADE_INQUIRY',
          entityId: inquiry.id,
          metadata: {
            bookingId: newBooking.id,
            bookingReferenceCode: newBooking.referenceCode,
          },
        },
      });

      return {
        success: true,
        message: 'Inquiry successfully converted to official booking',
        booking: newBooking,
      };
    });
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
      search,
    } = query;
    this.logger.log(
      `listContactSubmissions invoked by admin ${adminUserId} with filters: ${JSON.stringify(query)}`,
    );

    const where: any = {};
    if (status) where.status = status;
    if (email) where.email = { contains: email, mode: 'insensitive' };
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { referenceCode: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { subject: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
      ];
    }
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

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
      READ: ['NEW', 'ARCHIVED'],
      ARCHIVED: ['READ', 'NEW'],
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
      recipientEmail: r.recipientEmail,
      subject: r.notificationType,
      notificationType: r.notificationType,
      status: r.status,
      attempts: r.attempts,
      originEvent: r.originEntityType,
      originEntityType: r.originEntityType,
      originReferenceCode: r.originReferenceCode,
      failureReason: r.failureReason || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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
      const normalizedDestination = targetDest.trim().toLowerCase();
      const destinationSlug = {
        egypt: 'egypt',
        turkey: 'turkey',
        jordan: 'jordan',
        morocco: 'morocco',
        dubai: 'dubai',
        uae: 'dubai',
        'united arab emirates': 'dubai',
        tunisia: 'tunisia',
        greece: 'greece',
        'multi-country': 'multi-country',
        'multi country': 'multi-country',
        religious: 'religious',
      }[normalizedDestination];

      if (destinationSlug) {
        // Filtering by a destination means filtering by the persisted
        // interface relation, not an incidental word in title/category/slug.
        andConditions.push({
          landingPages: {
            some: {
              landingPage: {
                slug: destinationSlug,
                type: 'DESTINATION',
                deletedAt: null,
              },
            },
          },
        });
      } else {
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

    // Build orderBy: custom sort fields take precedence; default is priority order
    let orderByClause: any;
    if (sortBy === 'isFeatured' || sortBy === 'displayOrder') {
      orderByClause = [
        { isFeatured: 'desc' },
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ];
    } else if (sortBy && sortBy !== 'createdAt') {
      orderByClause = { [sortBy]: sortOrder };
    } else {
      orderByClause = [
        { isFeatured: 'desc' },
        { displayOrder: 'asc' },
        { createdAt: sortOrder },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByClause,
        select: {
          id: true,
          slug: true,
          titleJsonb: true,
          category: true,
          basePriceUsd: true,
          durationJsonb: true,
          overviewJsonb: true,
          currency: true,
          isActive: true,
          status: true,
          isFeatured: true,
          displayOrder: true,
          country: true,
          city: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { bookings: true, reviews: true } },
          images: {
            orderBy: [{ isHero: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { imageUrl: true },
          },
          accommodations: {
            orderBy: { sortOrder: 'asc' },
            include: {
              hotel: {
                select: {
                  id: true,
                  slug: true,
                  nameJsonb: true,
                  destinationSlug: true,
                  city: true,
                  stars: true,
                  heroMediaId: true,
                },
              },
              room: {
                select: {
                  id: true,
                  slug: true,
                  nameJsonb: true,
                  ratePerNight: true,
                  currency: true,
                  maxOccupancy: true,
                },
              },
            },
          },
          landingPages: {
            include: {
              landingPage: {
                select: {
                  id: true,
                  slug: true,
                  titleJsonb: true,
                  type: true,
                  status: true,
                  isActive: true,
                },
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
      durationJsonb: t.durationJsonb,
      overviewJsonb: t.overviewJsonb,
      currency: t.currency,
      isActive: t.isActive,
      status: t.status,
      isFeatured: t.isFeatured,
      displayOrder: t.displayOrder,
      country: t.country,
      city: t.city,
      highlightsJsonb: (t as any).highlightsJsonb ?? [],
      includedServicesJsonb: (t as any).includedServicesJsonb ?? [],
      excludedServicesJsonb: (t as any).excludedServicesJsonb ?? [],
      departureInfoJsonb: (t as any).departureInfoJsonb ?? null,
      hotelInfoJsonb: (t as any).hotelInfoJsonb ?? null,
      seasonPricingJsonb: (t as any).seasonPricingJsonb ?? [],
      accommodations: (t.accommodations || []).map((acc) => ({
        ...acc,
        city: acc.destination,
        boardBasis: acc.regime,
        priceSupplementUsd: acc.priceSupplementUsd.toString(),
        room: acc.room
          ? {
              ...acc.room,
              ratePerNight: acc.room.ratePerNight.toString(),
              basePriceUsd: acc.room.ratePerNight.toString(),
            }
          : null,
      })),

      bookingCount: t._count.bookings,
      reviewCount: t._count.reviews,
      heroImage: t.images[0]?.imageUrl || null,
      landingPages: t.landingPages.map((lp) => ({
        id: lp.landingPage.id,
        slug: lp.landingPage.slug,
        titleJsonb: lp.landingPage.titleJsonb,
        type: lp.landingPage.type,
        isVisible: lp.isVisible,
        status: lp.landingPage.status,
        isActive: lp.landingPage.isActive,
        isFeatured: lp.isFeatured,
        sortOrder: lp.sortOrder,
      })),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
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

  /**
   * A single source of truth for the dashboard's catalogue counters.  These
   * values deliberately use the same visibility rules as the public tours
   * endpoint: a published, active tour must have an active published
   * destination interface relation marked visible.
   */
  async getTourCatalogOverview(
    adminUserId: string,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`getTourCatalogOverview invoked by admin ${adminUserId}`);
    const locales = ['ar', 'en', 'es', 'pt', 'it'];
    const hasText = (value: unknown, locale: string) =>
      Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as Record<string, unknown>)[locale] === 'string' &&
        ((value as Record<string, string>)[locale] || '').trim(),
      );

    const [tours, interfaces] = await Promise.all([
      this.prisma.tour.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          status: true,
          isActive: true,
          basePriceUsd: true,
          titleJsonb: true,
          overviewJsonb: true,
          durationJsonb: true,
          images: { select: { id: true }, take: 1 },
          itineraries: { select: { id: true }, take: 1 },
          landingPages: {
            select: {
              isVisible: true,
              landingPage: {
                select: {
                  id: true,
                  slug: true,
                  titleJsonb: true,
                  type: true,
                  status: true,
                  isActive: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.tourLandingPage.findMany({
        where: { type: 'DESTINATION', deletedAt: null },
        select: {
          id: true,
          slug: true,
          titleJsonb: true,
          status: true,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const isPublicRelation = (
      relation: (typeof tours)[number]['landingPages'][number],
    ) =>
      relation.isVisible &&
      relation.landingPage.type === 'DESTINATION' &&
      relation.landingPage.status === 'PUBLISHED' &&
      relation.landingPage.isActive &&
      !relation.landingPage.deletedAt;
    const isVisibleOnWebsite = (tour: (typeof tours)[number]) =>
      tour.status === 'PUBLISHED' &&
      tour.isActive &&
      tour.landingPages.some(isPublicRelation);

    const issues = tours.flatMap((tour) => {
      const missingLocales = locales.filter(
        (locale) =>
          !hasText(tour.titleJsonb, locale) ||
          !hasText(tour.overviewJsonb, locale) ||
          !hasText(tour.durationJsonb, locale),
      );
      const missingFields: string[] = [];
      if (missingLocales.length)
        missingFields.push('five-language core content');
      if (tour.basePriceUsd.lte(0)) missingFields.push('base price');
      if (tour.images.length === 0) missingFields.push('image');
      if (tour.itineraries.length === 0) missingFields.push('itinerary');
      if (
        !tour.landingPages.some(
          (relation) => relation.landingPage.type === 'DESTINATION',
        )
      ) {
        missingFields.push('destination interface');
      }
      return missingFields.length
        ? [{ slug: tour.slug, missingLocales, missingFields }]
        : [];
    });

    return {
      totalTours: tours.length,
      visibleOnWebsite: tours.filter(isVisibleOnWebsite).length,
      hiddenFromWebsite: tours.filter((tour) => !isVisibleOnWebsite(tour))
        .length,
      unpublished: tours.filter(
        (tour) => tour.status !== 'PUBLISHED' || !tour.isActive,
      ).length,
      unlinked: tours.filter(
        (tour) =>
          !tour.landingPages.some(
            (relation) => relation.landingPage.type === 'DESTINATION',
          ),
      ).length,
      interfaces: interfaces.map((landingPage) => {
        const attached = tours.filter((tour) =>
          tour.landingPages.some(
            (relation) => relation.landingPage.id === landingPage.id,
          ),
        );
        const visible = attached.filter(
          (tour) =>
            tour.status === 'PUBLISHED' &&
            tour.isActive &&
            tour.landingPages.some(
              (relation) =>
                relation.landingPage.id === landingPage.id &&
                isPublicRelation(relation),
            ),
        );
        return {
          slug: landingPage.slug,
          titleJsonb: landingPage.titleJsonb,
          isPublic: landingPage.status === 'PUBLISHED' && landingPage.isActive,
          total: attached.length,
          visible: visible.length,
          hidden: attached.length - visible.length,
        };
      }),
      integrity: {
        complete: tours.length - issues.length,
        needsReview: issues.length,
        issues,
      },
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
      ...rows.map((row) => row.map((cell) => this.toCsvCell(cell)).join(',')),
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
        accommodations: {
          orderBy: { sortOrder: 'asc' },
          include: {
            hotel: {
              select: {
                id: true,
                slug: true,
                nameJsonb: true,
                destinationSlug: true,
                city: true,
                stars: true,
                amenitiesJsonb: true,
                heroMediaId: true,
              },
            },
            room: {
              select: {
                id: true,
                slug: true,
                nameJsonb: true,
                descriptionJsonb: true,
                ratePerNight: true,
                currency: true,
                maxOccupancy: true,
                seasonPricings: {
                  orderBy: { createdAt: 'asc' },
                  include: { season: true },
                },
              },
            },
          },
        },
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
      accommodations: (tour.accommodations || []).map((acc) => ({
        ...acc,
        city: acc.destination,
        boardBasis: acc.regime,
        priceSupplementUsd: acc.priceSupplementUsd.toString(),
        room: acc.room
          ? {
              ...acc.room,
              ratePerNight: acc.room.ratePerNight.toString(),
              basePriceUsd: acc.room.ratePerNight.toString(),
              seasonPricings: (acc.room.seasonPricings || []).map((sp) => ({
                ...sp,
                ratePerNight: sp.ratePerNight.toString(),
                pricePerNightUsd: sp.ratePerNight.toString(),
                singleSupplement: sp.singleSupplement.toString(),
                childRate: sp.childRate.toString(),
                extraBedRate: sp.extraBedRate.toString(),
                season: sp.season
                  ? {
                      ...sp.season,
                      multiplier: sp.season.multiplier.toString(),
                    }
                  : undefined,
              })),
            }
          : null,
      })),
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
    const { itineraries, images, accommodations, ...tourData } = dto;
    this.assertTourImages(images);
    const safeTourData = this.prepareTourData(tourData, true, tourData.country);
    const safeItineraries = this.prepareTourItineraries(itineraries);
    const safeImages = this.prepareTourImages(images);

    const tour = await this.prisma.$transaction(async (tx) => {
      const createdTour = await tx.tour.create({
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

      if (accommodations && accommodations.length > 0) {
        await this.syncTourAccommodationsInTx(
          tx,
          createdTour.id,
          accommodations,
          safeTourData.hotelInfoJsonb,
        );
      }

      await this.autoLinkDestinationInterface(
        tx,
        createdTour.id,
        createdTour.country,
        createdTour.category,
      );

      await this.autoSeedTourAvailability(tx, createdTour.id);

      return createdTour;
    });

    return { success: true, slug: tour.slug };
  }

  async updateTour(slug: string, dto: UpdateTourDto, adminUserId: string) {
    this.logger.log(
      `updateTour invoked by admin ${adminUserId} for slug: ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);
    this.assertValidSeasonPricing(dto.seasonPricingJsonb);
    const { itineraries, images, accommodations, expectedUpdatedAt, ...tourData } = dto;
    this.assertTourImages(images);

    if (tourData.slug && tourData.slug.toLowerCase() !== slug.toLowerCase()) {
      const existingWithSlug = await this.prisma.tour.findUnique({
        where: { slug: tourData.slug.toLowerCase() },
      });
      if (existingWithSlug && existingWithSlug.id !== tour.id) {
        throw new ConflictException(
          `Tour with slug "${tourData.slug}" already exists. Please choose a different slug.`,
        );
      }
    }

    const safeTourData = this.prepareTourData(
      tourData,
      false,
      tourData.country ?? tour.country,
    );
    if (
      safeTourData.seasonPricingJsonb &&
      typeof safeTourData.seasonPricingJsonb === 'object' &&
      !Array.isArray(safeTourData.seasonPricingJsonb) &&
      tour.seasonPricingJsonb &&
      typeof tour.seasonPricingJsonb === 'object' &&
      !Array.isArray(tour.seasonPricingJsonb)
    ) {
      safeTourData.seasonPricingJsonb = {
        ...(tour.seasonPricingJsonb as Record<string, unknown>),
        ...(safeTourData.seasonPricingJsonb as Record<string, unknown>),
      };
    }
    const safeItineraries = this.prepareTourItineraries(itineraries);
    const safeImages = this.prepareTourImages(images);
    const updated = await this.prisma.$transaction(async (tx) => {
      const currentTour = await tx.tour.findUnique({
        where: { id: tour.id },
        select: { updatedAt: true },
      });
      if (
        expectedUpdatedAt &&
        (!currentTour ||
          currentTour.updatedAt.getTime() !==
            new Date(expectedUpdatedAt).getTime())
      ) {
        throw new ConflictException(
          'This tour was changed by another user. Reload it before saving your changes.',
        );
      }
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

      const res = await tx.tour.update({
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
                  expectedUpdatedAt: expectedUpdatedAt ?? null,
                  itinerariesReplaced: Boolean(itineraries),
                  imagesReplaced: Boolean(images),
                  accommodationsReplaced: Boolean(accommodations),
                },
              },
            ],
          },
        },
      });

      if (accommodations !== undefined) {
        await this.syncTourAccommodationsInTx(
          tx,
          res.id,
          accommodations,
          safeTourData.hotelInfoJsonb !== undefined
            ? safeTourData.hotelInfoJsonb
            : tour.hotelInfoJsonb,
        );
      }

      await this.autoLinkDestinationInterface(
        tx,
        res.id,
        res.country,
        res.category,
      );

      return res;
    });

    // Invalidate cache for both current and updated slug
    await this.invalidateTourCache(slug);
    if (updated.slug !== slug) {
      await this.invalidateTourCache(updated.slug);
    }

    return { success: true, slug: updated.slug };
  }

  async reorderTours(dto: ReorderToursDto, adminUserId: string) {
    this.logger.log(
      `reorderTours invoked by admin ${adminUserId} with ${dto.orders.length} items`,
    );

    const updates = dto.orders.map((item) =>
      this.prisma.tour.update({
        where: { slug: item.slug },
        data: { displayOrder: item.displayOrder },
      }),
    );

    await this.prisma.$transaction(updates);

    // Invalidate public tour cache
    for (const item of dto.orders) {
      await this.invalidateTourCache(item.slug);
    }

    return { success: true, count: dto.orders.length };
  }

  async toggleFeatured(slug: string, isFeatured: boolean, adminUserId: string) {
    this.logger.log(
      `toggleFeatured invoked by admin ${adminUserId} for tour ${slug} to ${isFeatured}`,
    );

    const tour = await this.prisma.tour.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    const updated = await this.prisma.tour.update({
      where: { id: tour.id },
      data: { isFeatured },
      select: { id: true, slug: true, isFeatured: true, displayOrder: true },
    });

    await this.invalidateTourCache(slug);

    return {
      success: true,
      slug: updated.slug,
      isFeatured: updated.isFeatured,
    };
  }

  /**
   * Destination pages are the catalogue's source of truth for a tour's
   * placement. Updating only `country` makes the old interface keep showing
   * the tour, so location data and the destination relation must change in
   * the same transaction.
   */
  async moveTour(slug: string, dto: MoveTourDto, adminUserId: string) {
    let targetSlug = dto.destinationSlug?.trim().toLowerCase();
    if (!targetSlug) {
      targetSlug = this.canonicalDestinationSlugForCountry(dto.country);
    }

    const moved = await this.prisma.$transaction(
      async (tx) => {
        const tour = await tx.tour.findUnique({
          where: { slug },
          select: { id: true, category: true },
        });
        if (!tour)
          throw new NotFoundException(`Tour with slug ${slug} not found`);

        let target = await tx.tourLandingPage.findFirst({
          where: {
            slug: targetSlug,
            type: 'DESTINATION',
            deletedAt: null,
          },
          select: { id: true, slug: true },
        });

        if (!target) {
          target = await tx.tourLandingPage.findFirst({
            where: {
              type: 'DESTINATION',
              deletedAt: null,
              slug: { contains: targetSlug },
            },
            select: { id: true, slug: true },
          });
        }

        if (target) {
          const maxSortOrder = await tx.tourLandingPageTour.aggregate({
            where: { landingPageId: target.id },
            _max: { sortOrder: true },
          });

          await tx.tourLandingPageTour.deleteMany({
            where: {
              tourId: tour.id,
              landingPage: { type: 'DESTINATION' },
            },
          });
          await tx.tourLandingPageTour.create({
            data: {
              landingPageId: target.id,
              tourId: tour.id,
              sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
              isVisible: true,
              isFeatured: false,
            },
          });
        }

        return tx.tour.update({
          where: { id: tour.id },
          data: {
            country: dto.country.trim(),
            city: dto.city?.trim() || null,
            category: dto.category?.trim() || tour.category,
            activityLogs: {
              create: {
                userId: adminUserId,
                action: 'TOUR_MOVED',
                details: {
                  destinationSlug: target ? target.slug : targetSlug,
                  country: dto.country,
                  city: dto.city ?? null,
                },
              },
            },
          },
          select: { slug: true },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    await this.invalidateTourCache(slug);
    return { success: true, slug: moved.slug, destinationSlug: targetSlug };
  }

  private assertValidSeasonPricing(
    seasonPricing?:
      | Array<{
          startDate: string;
          endDate: string;
          multiplier?: number;
          priceUsd?: number;
          supplementUsd?: number;
        }>
      | Record<string, any>
      | null,
  ): void {
    if (!seasonPricing) return;
    let rawRules: Array<any> = [];
    if (Array.isArray(seasonPricing)) {
      rawRules = seasonPricing;
    } else if (typeof seasonPricing === 'object') {
      if (seasonPricing.rules !== undefined && !Array.isArray(seasonPricing.rules)) {
        throw new BadRequestException('Seasonal pricing rules must be an array');
      }
      rawRules = Array.isArray(seasonPricing.rules) ? seasonPricing.rules : [];
    } else {
      throw new BadRequestException('Seasonal pricing configuration is invalid');
    }

    if (rawRules.length === 0) return;

    const normalized = rawRules
      .map((rule) => {
        const start = new Date(rule?.startDate).getTime();
        const end = new Date(rule?.endDate).getTime();
        const hasMultiplier = rule?.multiplier !== undefined && rule?.multiplier !== null;
        const hasPrice = rule?.priceUsd !== undefined && rule?.priceUsd !== null;
        const hasSupplement = rule?.supplementUsd !== undefined && rule?.supplementUsd !== null;
        const multiplier = hasMultiplier ? Number(rule.multiplier) : 1;
        const priceUsd = hasPrice ? Number(rule.priceUsd) : 0;
        const supplementUsd = hasSupplement ? Number(rule.supplementUsd) : 0;
        return {
          start,
          end,
          hasMultiplier,
          hasPrice,
          hasSupplement,
          multiplier,
          priceUsd,
          supplementUsd,
        };
      })
      .sort((a, b) => a.start - b.start);

    for (let index = 0; index < normalized.length; index++) {
      const rule = normalized[index];
      const invalidMultiplier =
        rule.hasMultiplier &&
        (!Number.isFinite(rule.multiplier) || rule.multiplier < 0.5 || rule.multiplier > 5);
      const invalidPrice =
        rule.hasPrice && (!Number.isFinite(rule.priceUsd) || rule.priceUsd < 0);
      const invalidSupplement =
        rule.hasSupplement && (!Number.isFinite(rule.supplementUsd) || rule.supplementUsd < 0);

      if (
        !Number.isFinite(rule.start) ||
        !Number.isFinite(rule.end) ||
        rule.start > rule.end ||
        (!rule.hasMultiplier && !rule.hasPrice && !rule.hasSupplement) ||
        invalidMultiplier ||
        invalidPrice ||
        invalidSupplement ||
        (index > 0 && rule.start <= normalized[index - 1].end)
      ) {
        throw new BadRequestException(
          'Seasonal pricing rules are invalid or overlapping',
        );
      }
    }
  }

  private canonicalDestinationSlugForCountry(country?: string | null): string {
    if (!country) return 'egypt';
    const c = country.trim().toLowerCase();
    if (c.includes('egypt') || c.includes('مصر')) return 'egypt';
    if (c.includes('turk') || c.includes('ترك')) return 'turkey';
    if (c.includes('jordan') || c.includes('أردن') || c.includes('اردن'))
      return 'jordan';
    if (
      c.includes('emirates') ||
      c.includes('dubai') ||
      c.includes('إمارات') ||
      c.includes('امارات') ||
      c.includes('دبي')
    )
      return 'dubai';
    if (c.includes('morocco') || c.includes('مغرب')) return 'morocco';
    if (c.includes('greece') || c.includes('يونان')) return 'greece';
    if (c.includes('tunis') || c.includes('تونس')) return 'tunisia';
    if (c.includes('multi') || c.includes('متعدد')) return 'multi-country';
    return 'egypt';
  }

  private async autoLinkDestinationInterface(
    tx: Prisma.TransactionClient,
    tourId: string,
    country?: string | null,
    category?: string | null,
  ) {
    try {
      const isMulti =
        Boolean(
          category &&
          (category.toLowerCase().includes('multi') ||
            category.includes('متعدد')),
        ) ||
        Boolean(
          country &&
          (country.toLowerCase().includes('multi') ||
            country.includes('متعدد')),
        );
      const targetSlug = isMulti
        ? 'multi-country'
        : this.canonicalDestinationSlugForCountry(country);

      const target = await tx.tourLandingPage.findFirst({
        where: {
          slug: targetSlug,
          type: 'DESTINATION',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!target) return;

      // Check if tour is already linked to the target landing page
      const alreadyLinked = await tx.tourLandingPageTour.findUnique({
        where: {
          landingPageId_tourId: {
            landingPageId: target.id,
            tourId,
          },
        },
      });

      if (alreadyLinked) {
        if (!alreadyLinked.isVisible) {
          await tx.tourLandingPageTour.update({
            where: { id: alreadyLinked.id },
            data: { isVisible: true },
          });
        }
        return;
      }

      // If not multi-country, clean up other single DESTINATION links so tour moves cleanly to new destination
      if (!isMulti) {
        await tx.tourLandingPageTour.deleteMany({
          where: {
            tourId,
            landingPageId: { not: target.id },
            landingPage: { type: 'DESTINATION' },
          },
        });
      }

      const maxSortOrder = await tx.tourLandingPageTour.aggregate({
        where: { landingPageId: target.id },
        _max: { sortOrder: true },
      });

      await tx.tourLandingPageTour.upsert({
        where: {
          landingPageId_tourId: {
            landingPageId: target.id,
            tourId,
          },
        },
        update: {
          isVisible: true,
        },
        create: {
          landingPageId: target.id,
          tourId,
          sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
          isVisible: true,
          isFeatured: false,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `autoLinkDestinationInterface non-fatal error for tour ${tourId}: ${err?.message}`,
      );
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
    effectiveCountry: unknown = data.country,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...data };

    // Fallback/alias mappings for frontend compatibility
    if (data.descriptionJsonb && !data.overviewJsonb) {
      result.overviewJsonb = data.descriptionJsonb;
    }
    if (data.highlightJsonb && !data.highlightsJsonb) {
      result.highlightsJsonb = data.highlightJsonb;
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
      'subtitleJsonb',
      'durationJsonb',
      'minPaxJsonb',
      'pickupLocationsJsonb',
    ] as const;
    const richJsonFields = [
      'overviewJsonb',
      'highlightsJsonb',
      'departureInfoJsonb',
      'sourceCodeJsonb',
      'includedServicesJsonb',
      'excludedServicesJsonb',
      'hotelInfoJsonb',
      'transportationJsonb',
      'cancellationPolicyJsonb',
      'termsJsonb',
      'routeMapJsonb',
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
        result[key] = this.sanitizeTourLocalizedJson(result[key], key, true);
      }
    }

    // Normalize the trip hotel rate sheet (hotel category, hotel + city names,
    // double & single room rates, seasonal fee, boats). The dashboard may send
    // the rows either inside hotelInfoJsonb.accommodation or as a top-level
    // `accommodations` array; both are merged into hotelInfoJsonb so the public
    // API has a single, localized source of truth.
    const topLevelAccommodations = Array.isArray(result.accommodations)
      ? (result.accommodations as Record<string, any>[])
      : undefined;
    const hasHotelInfoKey = Object.prototype.hasOwnProperty.call(
      result,
      'hotelInfoJsonb',
    );
    const hasHotelInfo =
      Boolean(result.hotelInfoJsonb) &&
      typeof result.hotelInfoJsonb === 'object' &&
      !Array.isArray(result.hotelInfoJsonb) &&
      Object.keys(result.hotelInfoJsonb as Record<string, unknown>).length > 0;
    // Only touch hotelInfoJsonb when the caller explicitly sent it (this is how
    // the dashboard clears the rate sheet) or when there is non-empty row data to
    // merge. This prevents an unrelated partial update that merely echoes an empty
    // `accommodations: []` array from wiping existing hotel information.
    if (
      hasHotelInfo ||
      hasHotelInfoKey ||
      (topLevelAccommodations && topLevelAccommodations.length > 0)
    ) {
      const baseHotelInfo = hasHotelInfo
        ? (result.hotelInfoJsonb as Record<string, any>)
        : {};
      const existingRows = Array.isArray(baseHotelInfo.accommodation)
        ? baseHotelInfo.accommodation
        : Array.isArray(baseHotelInfo.accommodations)
          ? baseHotelInfo.accommodations
          : [];
      result.hotelInfoJsonb = this.sanitizeTourHotelInfo({
        ...baseHotelInfo,
        accommodation:
          existingRows.length > 0
            ? existingRows
            : (topLevelAccommodations ?? []),
      });
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
      'accommodations',
    ];
    for (const key of nonPrismaKeys) {
      delete result[key];
    }

    return result;
  }

  private prepareTourItineraries(itineraries?: CreateTourDto['itineraries']) {
    if (!itineraries) return undefined;
    return itineraries.map((itinerary) => ({
      dayLabel: itinerary.dayLabel
        ? sanitizePlainText(itinerary.dayLabel).slice(0, 255)
        : undefined,
      titleJsonb:
        itinerary.titleJsonb && Object.keys(itinerary.titleJsonb).length > 0
          ? this.sanitizeTourLocalizedJson(
              itinerary.titleJsonb,
              'itinerary.titleJsonb',
              false,
            )
          : undefined,
      descriptionJsonb: this.sanitizeTourLocalizedJson(
        itinerary.descriptionJsonb,
        'itinerary.descriptionJsonb',
        true,
        true,
      ),
      mealsJsonb:
        itinerary.mealsJsonb && Object.keys(itinerary.mealsJsonb).length > 0
          ? this.sanitizeTourLocalizedJson(
              itinerary.mealsJsonb,
              'itinerary.mealsJsonb',
              true,
            )
          : undefined,
      activitiesJsonb:
        itinerary.activitiesJsonb &&
        Object.keys(itinerary.activitiesJsonb).length > 0
          ? this.sanitizeTourLocalizedJson(
              itinerary.activitiesJsonb,
              'itinerary.activitiesJsonb',
              true,
            )
          : undefined,
      hotelsJsonb:
        itinerary.hotelsJsonb && Object.keys(itinerary.hotelsJsonb).length > 0
          ? this.sanitizeTourLocalizedJson(
              itinerary.hotelsJsonb,
              'itinerary.hotelsJsonb',
              true,
            )
          : undefined,
      transportationJsonb:
        itinerary.transportationJsonb &&
        Object.keys(itinerary.transportationJsonb).length > 0
          ? this.sanitizeTourLocalizedJson(
              itinerary.transportationJsonb,
              'itinerary.transportationJsonb',
              true,
            )
          : undefined,
      notesJsonb:
        itinerary.notesJsonb && Object.keys(itinerary.notesJsonb).length > 0
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
      videoUrl:
        image.videoUrl && String(image.videoUrl).trim().length > 0
          ? String(image.videoUrl).trim()
          : null,
      altText: image.altText
        ? sanitizePlainText(image.altText).slice(0, 255)
        : null,
      sortOrder: image.sortOrder ?? 1,
    }));
  }

  private static readonly TOUR_CONTENT_LOCALES = [
    'ar',
    'en',
    'es',
    'pt',
    'it',
  ];

  /**
   * Sanitizes a 5-locale map (or a plain string) into a clean `{ locale: text }`
   * object. Returns `undefined` when there is no usable text so that empty
   * columns are never persisted or rendered.
   */
  private sanitizeTourLocalizedMap(
    value: unknown,
    maxLength = 255,
  ): Record<string, string> | undefined {
    if (typeof value === 'string') {
      const clean = sanitizePlainText(value).slice(0, maxLength);
      return clean ? { en: clean } : undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [locale, raw] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!AdminService.TOUR_CONTENT_LOCALES.includes(locale)) continue;
      if (typeof raw !== 'string') continue;
      const clean = sanitizePlainText(raw).slice(0, maxLength);
      if (clean) out[locale] = clean;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  private static toNonNegativeNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return undefined;
    return Math.round(parsed * 100) / 100;
  }

  /**
   * Normalizes the trip hotel rate sheet stored in `hotelInfoJsonb`.
   *
   * Each accommodation row carries the six dashboard columns:
   *  1. hotel category              -> categoryTier
   *  2. hotel name + city           -> nameJsonb / cityJsonb (5 locales)
   *  3. double room price           -> doubleRoomPriceUsd
   *  4. single room price           -> singleRoomPriceUsd
   *  5. seasonal fee / surcharge    -> seasonSupplementUsd
   *  6. boats (name + extra price)  -> boatJsonb / boatPriceUsd
   *
   * Rows without any meaningful value are dropped so the public API never
   * renders an empty column.
   */
  private sanitizeTourHotelInfo(
    value: Record<string, any>,
  ): Prisma.InputJsonValue {
    const result: Record<string, unknown> = {};

    if (typeof value.hotelCategory === 'string' && value.hotelCategory.trim()) {
      result.hotelCategory = sanitizePlainText(value.hotelCategory).slice(
        0,
        100,
      );
    }

    const notes = this.sanitizeTourLocalizedMap(value.notes, 5_000);
    if (notes) result.notes = notes;

    const rawRows = Array.isArray(value.accommodation)
      ? value.accommodation
      : Array.isArray(value.accommodations)
        ? value.accommodations
        : [];

    const rows = rawRows
      .filter(
        (row): row is Record<string, any> =>
          Boolean(row) && typeof row === 'object' && !Array.isArray(row),
      )
      .map((raw, index) => {
        const row: Record<string, unknown> = {};

        if (raw.id) row.id = sanitizePlainText(String(raw.id)).slice(0, 100);
        if (raw.hotelId) {
          row.hotelId = sanitizePlainText(String(raw.hotelId)).slice(0, 100);
        }
        if (
          raw.roomId !== undefined &&
          raw.roomId !== null &&
          raw.roomId !== ''
        ) {
          row.roomId = sanitizePlainText(String(raw.roomId)).slice(0, 100);
        }
        if (raw.categoryTier) {
          row.categoryTier = sanitizePlainText(String(raw.categoryTier)).slice(
            0,
            50,
          );
        }

        const hotelName = this.sanitizeTourLocalizedMap(
          raw.nameJsonb ?? raw.hotelName ?? raw.name,
          255,
        );
        if (hotelName) row.nameJsonb = hotelName;

        const city = this.sanitizeTourLocalizedMap(
          raw.cityJsonb ?? raw.city,
          120,
        );
        if (city) row.cityJsonb = city;

        if (typeof raw.destination === 'string' && raw.destination.trim()) {
          row.destination = sanitizePlainText(raw.destination).slice(0, 120);
        }

        const doublePrice = AdminService.toNonNegativeNumber(
          raw.doubleRoomPriceUsd,
        );
        if (doublePrice !== undefined) row.doubleRoomPriceUsd = doublePrice;

        const singlePrice = AdminService.toNonNegativeNumber(
          raw.singleRoomPriceUsd,
        );
        if (singlePrice !== undefined) row.singleRoomPriceUsd = singlePrice;

        const seasonFee = AdminService.toNonNegativeNumber(
          raw.seasonSupplementUsd ?? raw.priceSupplementUsd,
        );
        if (seasonFee !== undefined) row.seasonSupplementUsd = seasonFee;

        const boatName = this.sanitizeTourLocalizedMap(
          raw.boatJsonb ?? raw.boatName,
          255,
        );
        if (boatName) row.boatJsonb = boatName;

        const boatPrice = AdminService.toNonNegativeNumber(raw.boatPriceUsd);
        if (boatPrice !== undefined) row.boatPriceUsd = boatPrice;

        const nights = Number(raw.nights);
        row.nights = Number.isFinite(nights)
          ? Math.min(Math.max(Math.round(nights), 1), 90)
          : 1;
        if (raw.regime) {
          row.regime = sanitizePlainText(String(raw.regime)).slice(0, 10);
        }
        row.isDefault = Boolean(raw.isDefault ?? index === 0);
        const sortOrder = Number(raw.sortOrder);
        row.sortOrder = Number.isFinite(sortOrder) ? sortOrder : index;

        return row;
      })
      .filter((row) =>
        Object.keys(row).some(
          (key) =>
            !['nights', 'regime', 'isDefault', 'sortOrder'].includes(key),
        ),
      );

    if (rows.length > 0) result.accommodation = rows;

    return result as Prisma.InputJsonValue;
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
              ? (richText
                  ? sanitizeHtmlContent(v)
                  : sanitizePlainText(v)
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
      throw new BadRequestException('Only published tours can be activated');
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

    const activeBookings = await this.prisma.booking.count({
      where: {
        tourId: tour.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        arrivalDate: { gte: new Date() },
      },
    });
    if (activeBookings > 0) {
      throw new BadRequestException(
        `Cannot delete tour with ${activeBookings} active or upcoming bookings.`,
      );
    }

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

  async clearAllTours(adminUserId: string) {
    this.logger.warn(
      `clearAllTours invoked by admin ${adminUserId} — soft-deleting all tours`,
    );
    const now = new Date();
    const result = await this.prisma.tour.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: now, status: 'ARCHIVED', isActive: false },
    });

    // Best-effort cache eviction — ignore individual miss errors
    const tours = await this.prisma.tour.findMany({
      where: { deletedAt: now },
      select: { slug: true },
    });
    const langs = ['en', 'es', 'pt', 'it', 'ar'];
    await Promise.allSettled(
      tours.flatMap((t) =>
        langs.map((l) => this.cacheManager.del(`tour:${t.slug}:${l}`)),
      ),
    );

    return {
      success: true,
      message: `${result.count} tours archived`,
      count: result.count,
    };
  }

  async publishTour(slug: string, adminUserId: string) {
    return this.transitionTourLifecycle(slug, 'PUBLISHED', adminUserId);
  }

  async unpublishTour(slug: string, adminUserId: string) {
    return this.transitionTourLifecycle(slug, 'DRAFT', adminUserId);
  }

  async archiveTour(slug: string, adminUserId: string) {
    return this.transitionTourLifecycle(slug, 'ARCHIVED', adminUserId);
  }

  async unarchiveTour(slug: string, adminUserId: string) {
    return this.transitionTourLifecycle(slug, 'DRAFT', adminUserId, true);
  }

  /**
   * Lifecycle transitions are kept server-side. ARCHIVED is reversible and
   * distinct from soft deletion; restoring either state always produces a
   * draft so an administrator must explicitly publish it again.
   */
  private async transitionTourLifecycle(
    slug: string,
    targetStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    adminUserId: string,
    restoreDeleted = false,
  ) {
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    if (tour.deletedAt && !restoreDeleted) {
      throw new BadRequestException(
        'Restore the soft-deleted tour before changing its lifecycle',
      );
    }

    const isPublic = targetStatus === 'PUBLISHED';
    const updated = await this.prisma.tour.update({
      where: { id: tour.id },
      data: {
        status: targetStatus,
        isActive: isPublic,
        ...(restoreDeleted ? { deletedAt: null } : {}),
        activityLogs: {
          create: {
            userId: adminUserId,
            action: `TOUR_${targetStatus}${restoreDeleted ? '_RESTORED' : ''}`,
            details: {
              previousStatus: tour.status,
              targetStatus,
              restoredFromSoftDelete: restoreDeleted,
            },
          },
        },
      },
    });
    if (targetStatus === 'PUBLISHED') {
      try {
        await this.autoSeedTourAvailability(this.prisma, tour.id);
      } catch (e) {
        this.logger.warn(`Failed to auto-seed availability for ${slug}: ${e}`);
      }
    }
    await this.invalidateTourCache(slug);
    return {
      success: true,
      slug: updated.slug,
      status: updated.status,
      isActive: updated.isActive,
    };
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

  async addTourImage(slug: string, dto: AddTourImageDto, adminUserId: string) {
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

  async setTourHeroImage(slug: string, imageId: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} selecting image ${imageId} as hero for tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    if (!tour) throw new NotFoundException('Tour not found');

    const image = await this.prisma.$transaction(async (tx) => {
      const selected = await tx.tourImage.findFirst({
        where: { id: imageId, tourId: tour.id },
        select: { id: true },
      });
      if (!selected) throw new NotFoundException('Tour image not found');

      await tx.tourImage.updateMany({
        where: { tourId: tour.id, isHero: true },
        data: { isHero: false },
      });
      await tx.tourImage.update({
        where: { id: imageId },
        data: { isHero: true },
      });
      await tx.tourActivityLog.create({
        data: {
          tourId: tour.id,
          userId: adminUserId,
          action: 'TOUR_HERO_IMAGE_UPDATED',
          details: { imageId },
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
          dayLabel: sanitizePlainText(dto.dayLabel).slice(0, 100),
          titleJsonb: dto.titleJsonb
            ? this.sanitizeTourLocalizedJson(
                dto.titleJsonb,
                'titleJsonb',
                false,
              )
            : Prisma.JsonNull,
          descriptionJsonb: this.sanitizeTourLocalizedJson(
            dto.descriptionJsonb,
            'descriptionJsonb',
            true,
            true,
          ),
          mealsJsonb: dto.mealsJsonb
            ? this.sanitizeTourLocalizedJson(dto.mealsJsonb, 'mealsJsonb', true)
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
            dayLabel: sanitizePlainText(dto.dayLabel).slice(0, 100),
          }),
          ...(dto.titleJsonb !== undefined && {
            titleJsonb: dto.titleJsonb
              ? this.sanitizeTourLocalizedJson(
                  dto.titleJsonb,
                  'titleJsonb',
                  false,
                )
              : Prisma.JsonNull,
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

  async getTourAccommodations(slug: string, adminUserId: string) {
    this.logger.log(
      `Admin ${adminUserId} fetching accommodations for tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    const items = await this.prisma.tripAccommodation.findMany({
      where: { tourId: tour.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        hotel: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            destinationSlug: true,
            city: true,
            stars: true,
            amenitiesJsonb: true,
            heroMediaId: true,
          },
        },
        room: {
          select: {
            id: true,
            slug: true,
            nameJsonb: true,
            descriptionJsonb: true,
            ratePerNight: true,
            currency: true,
            maxOccupancy: true,
            seasonPricings: {
              orderBy: { createdAt: 'asc' },
              include: { season: true },
            },
          },
        },
      },
    });

    return items.map((acc) => ({
      ...acc,
      city: acc.destination,
      boardBasis: acc.regime,
      priceSupplementUsd: acc.priceSupplementUsd.toString(),
      room: acc.room
        ? {
            ...acc.room,
            ratePerNight: acc.room.ratePerNight.toString(),
            basePriceUsd: acc.room.ratePerNight.toString(),
            seasonPricings: (acc.room.seasonPricings || []).map((sp) => ({
              ...sp,
              ratePerNight: sp.ratePerNight.toString(),
              pricePerNightUsd: sp.ratePerNight.toString(),
              singleSupplement: sp.singleSupplement.toString(),
              childRate: sp.childRate.toString(),
              extraBedRate: sp.extraBedRate.toString(),
              season: sp.season
                ? {
                    ...sp.season,
                    multiplier: sp.season.multiplier.toString(),
                  }
                : undefined,
            })),
          }
        : null,
    }));
  }

  async upsertTourAccommodations(
    slug: string,
    accommodations: TripAccommodationDto[],
    adminUserId: string,
  ) {
    this.logger.log(
      `Admin ${adminUserId} updating accommodations for tour ${slug}`,
    );
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      select: { id: true, slug: true, hotelInfoJsonb: true },
    });
    if (!tour) throw new NotFoundException(`Tour with slug ${slug} not found`);

    await this.prisma.$transaction(async (tx) => {
      await this.syncTourAccommodationsInTx(
        tx,
        tour.id,
        accommodations,
        tour.hotelInfoJsonb,
      );
      if (tx.tourActivityLog?.create) {
        await tx.tourActivityLog.create({
          data: {
            tourId: tour.id,
            userId: adminUserId,
            action: 'TOUR_ACCOMMODATIONS_UPDATED',
            details: { count: accommodations.length },
          },
        });
      }
    });

    await this.invalidateTourCache(slug);
    return this.getTourAccommodations(slug, adminUserId);
  }

  private async syncTourAccommodationsInTx(
    tx: Prisma.TransactionClient,
    tourId: string,
    accommodations: TripAccommodationDto[],
    existingHotelInfoJsonb: unknown,
  ): Promise<void> {
    if (!tx.tripAccommodation) return;

    await tx.tripAccommodation.deleteMany({ where: { tourId } });

    const hotelIds = [
      ...new Set(
        accommodations
          .map((a) => a.hotelId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const roomIds = [
      ...new Set(
        accommodations
          .map((a) => a.roomId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const hotelsMap = new Map<
      string,
      {
        id: string;
        slug: string;
        nameJsonb: Prisma.JsonValue;
        destinationSlug: string;
        city: string;
        stars: number;
        amenitiesJsonb: Prisma.JsonValue | null;
      }
    >();
    const roomsMap = new Map<
      string,
      {
        id: string;
        hotelId: string;
        slug: string;
      }
    >();

    if (hotelIds.length > 0 && tx.hotel?.findMany) {
      const hotels = await tx.hotel.findMany({
        where: { id: { in: hotelIds }, deletedAt: null },
        select: {
          id: true,
          slug: true,
          nameJsonb: true,
          destinationSlug: true,
          city: true,
          stars: true,
          amenitiesJsonb: true,
        },
      });
      for (const h of hotels) {
        hotelsMap.set(h.id, h);
      }
      for (const requestedHotelId of hotelIds) {
        if (!hotelsMap.has(requestedHotelId)) {
          throw new BadRequestException(
            `Assigned hotel '${requestedHotelId}' does not exist or has been deleted`,
          );
        }
      }
    }

    if (roomIds.length > 0 && tx.hotelRoom?.findMany) {
      const rooms = await tx.hotelRoom.findMany({
        where: { id: { in: roomIds }, deletedAt: null },
        select: {
          id: true,
          hotelId: true,
          slug: true,
        },
      });
      for (const r of rooms) {
        roomsMap.set(r.id, r);
      }
      for (const requestedRoomId of roomIds) {
        if (!roomsMap.has(requestedRoomId)) {
          throw new BadRequestException(
            `Assigned room '${requestedRoomId}' does not exist or has been deleted`,
          );
        }
      }
    }

    const cityHotelsMap: Record<string, string[]> = {};
    const summaryAccommodations: Array<Record<string, unknown>> = [];

    for (let index = 0; index < accommodations.length; index++) {
      const item = accommodations[index];
      const cleanHotelId = item.hotelId && item.hotelId.trim() ? item.hotelId.trim() : null;
      const cleanRoomId = item.roomId && item.roomId.trim() ? item.roomId.trim() : null;

      if (cleanRoomId && cleanHotelId && roomsMap.has(cleanRoomId)) {
        const roomRecord = roomsMap.get(cleanRoomId)!;
        if (roomRecord.hotelId !== cleanHotelId) {
          throw new BadRequestException(
            `Room '${cleanRoomId}' does not belong to hotel '${cleanHotelId}'`,
          );
        }
      }

      const hotelRecord = cleanHotelId ? hotelsMap.get(cleanHotelId) : undefined;
      const effectiveCity =
        (item.destination && item.destination.trim()) ||
        (item.city && item.city.trim()) ||
        hotelRecord?.city ||
        'Destination';
      const effectiveRegime =
        (item.regime && item.regime.trim()) ||
        (item.boardBasis && item.boardBasis.trim()) ||
        'BB';

      await tx.tripAccommodation.create({
        data: {
          tourId,
          hotelId: cleanHotelId,
          roomId: cleanRoomId,
          destination: effectiveCity,
          categoryTier: item.categoryTier?.trim() || null,
          regime: effectiveRegime,
          nights: item.nights ?? 1,
          priceSupplementUsd: new Prisma.Decimal(item.priceSupplementUsd ?? 0),
          isDefault: item.isDefault ?? true,
          notesJsonb: item.notesJsonb ? (item.notesJsonb as Prisma.InputJsonValue) : Prisma.JsonNull,
          sortOrder: item.sortOrder ?? index,
        },
      });

      const nameObj =
        hotelRecord?.nameJsonb && typeof hotelRecord.nameJsonb === 'object'
          ? (hotelRecord.nameJsonb as Record<string, string>)
          : {};
      const hotelDisplayName =
        nameObj.en ||
        Object.values(nameObj).find((v) => typeof v === 'string' && v.trim()) ||
        hotelRecord?.slug ||
        cleanHotelId ||
        effectiveCity;

      if (hotelDisplayName) {
        if (!cityHotelsMap[effectiveCity]) {
          cityHotelsMap[effectiveCity] = [];
        }
        if (!cityHotelsMap[effectiveCity].includes(hotelDisplayName)) {
          cityHotelsMap[effectiveCity].push(hotelDisplayName);
        }
      }

      const heroImageUrl =
        (hotelRecord?.amenitiesJsonb as Record<string, any> | null)?.heroImageUrl ?? null;

      summaryAccommodations.push({
        hotelId: cleanHotelId,
        hotelSlug: hotelRecord?.slug ?? null,
        hotelNameJsonb: hotelRecord?.nameJsonb ?? { en: hotelDisplayName },
        stars: hotelRecord?.stars ?? 5,
        starRating: hotelRecord?.stars ?? 5,
        heroImageUrl,
        roomId: cleanRoomId,
        destination: effectiveCity,
        city: effectiveCity,
        categoryTier: item.categoryTier || null,
        regime: effectiveRegime,
        boardBasis: effectiveRegime,
        nights: item.nights ?? 1,
        dayFrom: item.dayFrom ?? null,
        dayTo: item.dayTo ?? null,
        priceSupplementUsd: Number(item.priceSupplementUsd ?? 0).toFixed(2),
        isDefault: item.isDefault ?? true,
        notesJsonb: item.notesJsonb ?? null,
        sortOrder: item.sortOrder ?? index,
      });
    }

    const baseHotelInfo =
      existingHotelInfoJsonb &&
      typeof existingHotelInfoJsonb === 'object' &&
      !Array.isArray(existingHotelInfoJsonb)
        ? { ...(existingHotelInfoJsonb as Record<string, unknown>) }
        : {};

    const updatedHotelInfo: Record<string, unknown> = {
      ...baseHotelInfo,
      hotels:
        accommodations.length === 0
          ? {}
          : Object.keys(cityHotelsMap).length > 0
            ? cityHotelsMap
            : baseHotelInfo.hotels ?? {},
      accommodations: summaryAccommodations,
    };

    await tx.tour.update({
      where: { id: tourId },
      data: {
        hotelInfoJsonb: updatedHotelInfo as Prisma.InputJsonValue,
      },
    });
  }

  private async invalidateTourCache(slug: string): Promise<void> {
    for (const locale of ['en', 'es', 'pt', 'it', 'ar']) {
      await this.cacheManager.del(`tour:${slug}:${locale}`);
      await this.cacheManager.del(`tour:detail:${slug}:${locale}`);
      if (this.cacheService) {
        await this.cacheService.del(`tour:${slug}:${locale}`);
        await this.cacheService.del(`tour:detail:${slug}:${locale}`);
      }
    }
    try {
      const currentVersion = await this.cacheManager.get<number>('tours:catalog:version');
      const nextVersion = typeof currentVersion === 'number' ? currentVersion + 1 : 2;
      await this.cacheManager.set('tours:catalog:version', nextVersion, 86_400_000);
      if (this.cacheService) {
        await this.cacheService.set('tours:catalog:version', nextVersion, 86_400_000);
      }
    } catch {
      // Best-effort catalog version bump
    }
  }

  private async autoSeedTourAvailability(
    db: Prisma.TransactionClient | PrismaService,
    tourId: string,
    daysAhead: number = 365,
    capacity: number = 25,
  ): Promise<void> {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    const slotDates: Date[] = [];
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      slotDates.push(d);
    }

    await db.tourAvailability.createMany({
      data: slotDates.map((date) => ({
        tourId,
        date,
        totalCapacity: capacity,
        remainingSeats: capacity,
        status: 'AVAILABLE',
      })),
      skipDuplicates: true,
    });
  }
}
