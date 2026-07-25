import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TailorMadeInquiryStatus, Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
import {
  generateReferenceCode,
  generateInvoiceNumber,
} from '../../../common/utils/identifiers.util';
import { BookingsService } from '../../bookings/bookings.service';
import { InvoiceSnapshot } from '../../invoices/types';

@Injectable()
export class AdminTailorMadeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
  ) {}

  async findAll(
    pageVal: number = 1,
    limitVal: number = 10,
    status?: string,
    assigneeId?: string,
  ) {
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);
    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (status) where.status = status as TailorMadeInquiryStatus;
    if (assigneeId) where.assigneeId = assigneeId;

    const [total, records] = await this.prisma.$transaction([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { assignee: true, booking: true },
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async findOne(id: string) {
    const record = await this.prisma.tailorMadeInquiry.findUnique({
      where: { id },
      include: { assignee: true, booking: true },
    });
    if (!record) {
      throw new NotFoundException(
        `Tailor-made inquiry with ID ${id} not found`,
      );
    }
    return record;
  }

  async updateStatus(
    id: string,
    status: TailorMadeInquiryStatus,
    notes?: string,
    actorId?: string,
  ) {
    const inquiry = await this.findOne(id);

    if (inquiry.status === status) return inquiry;

    const validTransitions: Record<string, string[]> = {
      NEWLY_RECEIVED: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['QUOTED', 'CLOSED'],
      QUOTED: ['APPROVED', 'CLOSED'],
      APPROVED: ['CONVERTED_TO_BOOKING', 'CLOSED'],
      CONVERTED_TO_BOOKING: ['CLOSED'],
      CLOSED: [],
    };

    const allowed = validTransitions[inquiry.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition tailor-made inquiry from ${inquiry.status} to ${status}`,
      );
    }

    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { id },
      data: {
        status,
        ...(notes ? { internalNote: notes } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TAILOR_MADE_INQUIRY_STATUS_UPDATED',
        entityType: 'TAILOR_MADE_INQUIRY',
        entityId: id,
        metadata: {
          oldStatus: inquiry.status,
          newStatus: status,
          notes,
        },
      },
    });

    return updated;
  }

  async assignInquiry(id: string, assigneeId: string, actorId?: string) {
    const inquiry = await this.findOne(id);
    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { id },
      data: { assigneeId },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TAILOR_MADE_INQUIRY_ASSIGNED',
        entityType: 'TAILOR_MADE_INQUIRY',
        entityId: id,
        metadata: {
          oldAssigneeId: inquiry.assigneeId,
          newAssigneeId: assigneeId,
        },
      },
    });

    return updated;
  }

  async createQuote(
    id: string,
    amount: number,
    notes?: string,
    actorId?: string,
  ) {
    const inquiry = await this.findOne(id);
    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { id },
      data: {
        quotedAmountUsd: new Prisma.Decimal(amount),
        internalNote: notes,
        status: TailorMadeInquiryStatus.QUOTED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actorId || null,
        actorRole: 'ADMIN',
        action: 'TAILOR_MADE_INQUIRY_QUOTED',
        entityType: 'TAILOR_MADE_INQUIRY',
        entityId: id,
        metadata: {
          quotedAmountUsd: amount,
          notes,
        },
      },
    });

    return updated;
  }

  async convertToBooking(id: string) {
    const inquiry = await this.findOne(id);

    if (
      inquiry.status === TailorMadeInquiryStatus.CONVERTED_TO_BOOKING ||
      inquiry.bookingId
    ) {
      const existingBooking = await this.prisma.booking.findUnique({
        where: { id: inquiry.bookingId || undefined },
        include: { invoice: true, passengers: true, billingInfo: true },
      });
      return {
        inquiry,
        booking: existingBooking,
        invoice: existingBooking?.invoice || null,
      };
    }

    if (inquiry.status !== TailorMadeInquiryStatus.APPROVED) {
      throw new BadRequestException(
        'Inquiry must be APPROVED before conversion',
      );
    }

    const quotedAmount = inquiry.quotedAmountUsd;
    if (!quotedAmount) {
      throw new BadRequestException('Inquiry has no quoted amount');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedInquiryCount = await tx.tailorMadeInquiry.updateMany({
        where: {
          id,
          status: TailorMadeInquiryStatus.APPROVED,
          bookingId: null,
        },
        data: { status: TailorMadeInquiryStatus.CONVERTED_TO_BOOKING },
      });

      if (updatedInquiryCount.count === 0) {
        const recheck = await tx.tailorMadeInquiry.findUnique({
          where: { id },
          include: { booking: true },
        });
        if (recheck?.bookingId) {
          const existingBooking = await tx.booking.findUnique({
            where: { id: recheck.bookingId },
            include: { invoice: true, passengers: true, billingInfo: true },
          });
          return {
            inquiry: recheck,
            booking: existingBooking,
            invoice: existingBooking?.invoice || null,
          };
        }
        throw new BadRequestException(
          'Inquiry must be APPROVED and not already converted',
        );
      }

      const customSlug = `tailor-made-inquiry-${inquiry.id.slice(0, 8)}`;
      let tour = await tx.tour.findFirst({
        where: { slug: customSlug },
      });
      if (!tour) {
        tour = await tx.tour.create({
          data: {
            slug: customSlug,
            titleJsonb: {
              en: `Tailor-Made Custom Tour (${inquiry.referenceCode})`,
              ar: `جولة خاصة مخصصة (${inquiry.referenceCode})`,
              es: `Tour Personalizado (${inquiry.referenceCode})`,
              pt: `Tour Sob Medida (${inquiry.referenceCode})`,
              it: `Tour Su Misura (${inquiry.referenceCode})`,
            },
            basePriceUsd: quotedAmount,
            status: 'ARCHIVED',
            isActive: false,
          },
        });
      }

      const arrivalDate = inquiry.startDate || new Date();
      const adultsCount = inquiry.adults || 1;
      const childrenCount = inquiry.children || 0;
      const totalPassengers = Math.max(1, adultsCount + childrenCount);

      let availability = await tx.tourAvailability.findUnique({
        where: { tourId_date: { tourId: tour.id, date: arrivalDate } },
      });
      if (!availability) {
        availability = await tx.tourAvailability.create({
          data: {
            tourId: tour.id,
            date: arrivalDate,
            totalCapacity: totalPassengers,
            remainingSeats: 0,
            status: 'SOLD_OUT',
          },
        });
      }

      const referenceCode = generateReferenceCode('TMB');

      const passengersList: Array<{ passengerType: string; fullName: string }> =
        [];
      for (let i = 0; i < adultsCount; i++) {
        passengersList.push({
          passengerType: 'ADULT',
          fullName:
            i === 0 ? inquiry.fullName : `${inquiry.fullName} (Adult ${i + 1})`,
        });
      }
      for (let i = 0; i < childrenCount; i++) {
        passengersList.push({
          passengerType: 'CHILD',
          fullName: `${inquiry.fullName} (Child ${i + 1})`,
        });
      }

      const newBooking = await tx.booking.create({
        data: {
          referenceCode,
          tourId: tour.id,
          availabilityId: availability.id,
          arrivalDate,
          departureDate: inquiry.endDate || arrivalDate,
          adults: adultsCount,
          children: childrenCount,
          totalAmountUsd: quotedAmount,
          status: 'PENDING',
          bookingType: 'TAILOR_MADE',
          priority: 'HIGH',
          inquiryMessage: inquiry.notes,
          billingInfo: {
            create: {
              fullName: inquiry.fullName,
              email: inquiry.email,
              phone: inquiry.phone,
              invoiceType: 'PERSONAL',
            },
          },
          passengers: {
            createMany: {
              data: passengersList,
            },
          },
        },
      });

      const invoiceNumber = await generateInvoiceNumber(tx);

      const snapshotJsonb: InvoiceSnapshot = {
        version: 1,
        tourId: tour.id,
        tourTitle: `Tailor-Made Custom Tour (${inquiry.referenceCode})`,
        tourSlug: customSlug,
        arrivalDate: arrivalDate.toISOString().split('T')[0],
        departureDate: inquiry.endDate
          ? inquiry.endDate.toISOString().split('T')[0]
          : arrivalDate.toISOString().split('T')[0],
        adults: adultsCount,
        children: childrenCount,
        infants: 0,
        baseSubtotal: quotedAmount.toNumber(),
        discounts: [],
        tax: 0,
        total: quotedAmount.toNumber(),
        currency: 'USD',
        billingRecipient: {
          fullName: inquiry.fullName,
          email: inquiry.email,
          phone: inquiry.phone,
          invoiceType: 'PERSONAL',
          companyName: null,
          taxId: null,
          address: null,
          city: null,
          country: null,
        },
        passengers: passengersList.map((p) => ({
          passengerType: p.passengerType,
          fullName: p.fullName,
        })),
      };

      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          bookingId: newBooking.id,
          issuedAt: new Date(),
          status: 'SENT',
          subtotal: quotedAmount,
          tax: new Prisma.Decimal(0),
          total: quotedAmount,
          currency: 'USD',
          snapshotJsonb: snapshotJsonb as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.tailorMadeInquiry.update({
        where: { id },
        data: { bookingId: newBooking.id },
      });

      const updatedInquiry = await tx.tailorMadeInquiry.findUnique({
        where: { id },
        include: { booking: true },
      });

      return {
        inquiry: updatedInquiry,
        booking: newBooking,
        invoice: newInvoice,
      };
    });
  }
}
