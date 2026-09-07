import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  TailorMadeInquiryStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { paginate, getPaginationParams } from '../../../common/utils';
import {
  generateReferenceCode,
  generateInvoiceNumber,
} from '../../../common/utils/identifiers.util';
import { InvoiceSnapshot } from '../../invoices/types';
import { AuthenticatedUser } from '../../../common/types';
import { sanitizePlainText } from '../../../common/utils/content-sanitizer.util';

@Injectable()
export class AdminTailorMadeService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly inquirySelect = {
    id: true,
    referenceCode: true,
    fullName: true,
    email: true,
    phone: true,
    preferredLanguage: true,
    destinations: true,
    startDate: true,
    endDate: true,
    adults: true,
    children: true,
    budgetAmount: true,
    budgetCurrency: true,
    notes: true,
    assigneeId: true,
    followUpAt: true,
    internalNote: true,
    quotedAmountUsd: true,
    bookingId: true,
    partnerCode: true,
    companyId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    assignee: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    },
    booking: {
      select: {
        id: true,
        referenceCode: true,
        status: true,
        totalAmountUsd: true,
        paidAmountUsd: true,
        createdAt: true,
      },
    },
    company: {
      select: {
        id: true,
        name: true,
        referenceCode: true,
        taxId: true,
        tier: true,
        companyType: true,
        commissionRate: true,
      },
    },
  } satisfies Prisma.TailorMadeInquirySelect;

  private readonly bookingResultSelect = {
    id: true,
    referenceCode: true,
    status: true,
    bookingType: true,
    arrivalDate: true,
    departureDate: true,
    adults: true,
    children: true,
    infants: true,
    totalAmountUsd: true,
    paidAmountUsd: true,
    createdAt: true,
    passengers: {
      select: {
        id: true,
        passengerType: true,
        fullName: true,
      },
    },
    billingInfo: {
      select: {
        fullName: true,
        email: true,
        phone: true,
        invoiceType: true,
      },
    },
    invoice: {
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        subtotal: true,
        tax: true,
        total: true,
        currency: true,
        issuedAt: true,
      },
    },
  } satisfies Prisma.BookingSelect;

  async findAll(
    query: {
      page?: number;
      limit?: number;
      status?: TailorMadeInquiryStatus;
      referenceCode?: string;
      partnerCode?: string;
      search?: string;
    },
    assigneeId?: string,
  ) {
    const { skip, take, page, limit } = getPaginationParams(
      query.page,
      query.limit,
    );
    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (query.status) where.status = query.status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (query.partnerCode) where.partnerCode = query.partnerCode;
    if (query.referenceCode) {
      where.referenceCode = { contains: query.referenceCode, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { referenceCode: { contains: query.search, mode: 'insensitive' } },
        { partnerCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await this.prisma.$transaction([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: this.inquirySelect,
      }),
    ]);

    return paginate(records, total, page, limit);
  }

  async getMetrics(actor?: AuthenticatedUser) {
    const where: Prisma.TailorMadeInquiryWhereInput = {};
    if (actor?.role === UserRole.AGENT) {
      where.assigneeId = actor.id;
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
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'NEWLY_RECEIVED' } }),
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'QUOTED' } }),
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'CONVERTED_TO_BOOKING' } }),
      this.prisma.tailorMadeInquiry.count({ where: { ...where, status: 'CLOSED' } }),
      this.prisma.tailorMadeInquiry.findMany({
        where: { ...where, status: { notIn: ['CLOSED'] } },
        select: { quotedAmountUsd: true, budgetAmount: true },
      }),
    ]);

    const pipelineValue = activeInquiries.reduce((acc, curr) => {
      const val = curr.quotedAmountUsd
        ? Number(curr.quotedAmountUsd)
        : (curr.budgetAmount ? Number(curr.budgetAmount) : 0);
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

  private async getInquiry(idOrRef: string) {
    const record = await this.prisma.tailorMadeInquiry.findFirst({
      where: {
        OR: [
          { id: idOrRef },
          { referenceCode: idOrRef },
        ],
      },
      select: this.inquirySelect,
    });
    if (!record) {
      throw new NotFoundException(
        `Tailor-made inquiry with identifier ${idOrRef} not found`,
      );
    }
    return record;
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const record = await this.getInquiry(id);
    this.assertActorCanAccess(record.assigneeId, actor);
    return record;
  }

  private assertActorCanAccess(
    assigneeId: string | null,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === UserRole.AGENT && assigneeId !== actor.id) {
      throw new ForbiddenException(
        'You can only access inquiries assigned to you',
      );
    }
  }

  async updateStatus(
    id: string,
    status: TailorMadeInquiryStatus,
    notes?: string,
    actor?: AuthenticatedUser,
  ) {
    if (!actor) throw new ForbiddenException('Authenticated actor required');
    const inquiry = await this.getInquiry(id);
    this.assertActorCanAccess(inquiry.assigneeId, actor);

    if (inquiry.status === status) return inquiry;

    // CONVERTED_TO_BOOKING may ONLY be set via the dedicated convertToBooking() method
    // which creates the actual booking + invoice. Setting it directly corrupts data.
    if (status === TailorMadeInquiryStatus.CONVERTED_TO_BOOKING) {
      throw new BadRequestException(
        'Cannot set status to CONVERTED_TO_BOOKING directly. Use the Convert to Booking action instead.',
      );
    }

    const validTransitions: Record<string, string[]> = {
      NEWLY_RECEIVED: [
        'IN_PROGRESS',
        'QUOTED',
        'APPROVED',
        'CLOSED',
      ],
      IN_PROGRESS: [
        'QUOTED',
        'APPROVED',
        'CLOSED',
        'NEWLY_RECEIVED',
      ],
      QUOTED: [
        'APPROVED',
        'IN_PROGRESS',
        'CLOSED',
        'NEWLY_RECEIVED',
      ],
      APPROVED: [
        'QUOTED',
        'IN_PROGRESS',
        'CLOSED',
      ],
      CONVERTED_TO_BOOKING: [
        'CLOSED',
        'APPROVED', // Admin can revert a mis-converted inquiry back to APPROVED
      ],
      CLOSED: [
        'IN_PROGRESS',
        'NEWLY_RECEIVED',
        'QUOTED',
      ],
    };

    const allowed = validTransitions[inquiry.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition tailor-made inquiry from ${inquiry.status} to ${status}`,
      );
    }

    const safeNotes = notes
      ? sanitizePlainText(notes).slice(0, 5_000)
      : undefined;
    return this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.tailorMadeInquiry.updateMany({
          where: {
            id,
            status: inquiry.status,
            ...(actor.role === UserRole.AGENT && {
              assigneeId: actor.id,
            }),
          },
          data: {
            status,
            ...(safeNotes !== undefined && { internalNote: safeNotes }),
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Inquiry changed; reload before updating it',
          );
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TAILOR_MADE_INQUIRY_STATUS_UPDATED',
            entityType: 'TAILOR_MADE_INQUIRY',
            entityId: id,
            metadata: {
              oldStatus: inquiry.status,
              newStatus: status,
              notesUpdated: safeNotes !== undefined,
            },
          },
        });
        return tx.tailorMadeInquiry.findUniqueOrThrow({
          where: { id },
          select: this.inquirySelect,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async assignInquiry(
    id: string,
    assigneeId: string,
    actor: AuthenticatedUser,
  ) {
    const [inquiry, assignee] = await Promise.all([
      this.getInquiry(id),
      this.prisma.user.findFirst({
        where: {
          id: assigneeId,
          role: UserRole.AGENT,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);
    if (!assignee) {
      throw new BadRequestException('Assignee must be an active agent');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.tailorMadeInquiry.update({
          where: { id },
          data: { assigneeId },
          select: this.inquirySelect,
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
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
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async createQuote(
    id: string,
    amount: number,
    notes?: string,
    actor?: AuthenticatedUser,
  ) {
    if (!actor) throw new ForbiddenException('Authenticated actor required');
    const inquiry = await this.getInquiry(id);
    this.assertActorCanAccess(inquiry.assigneeId, actor);
    if (
      inquiry.status !== TailorMadeInquiryStatus.IN_PROGRESS &&
      inquiry.status !== TailorMadeInquiryStatus.QUOTED
    ) {
      throw new BadRequestException(
        'Only in-progress or already quoted inquiries can be quoted',
      );
    }
    const quotedAmount = new Prisma.Decimal(amount);
    const safeNotes =
      notes !== undefined
        ? sanitizePlainText(notes).slice(0, 5_000)
        : undefined;

    return this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.tailorMadeInquiry.updateMany({
          where: {
            id,
            status: inquiry.status,
            ...(actor.role === UserRole.AGENT && {
              assigneeId: actor.id,
            }),
          },
          data: {
            quotedAmountUsd: quotedAmount,
            ...(safeNotes !== undefined && { internalNote: safeNotes }),
            status: TailorMadeInquiryStatus.QUOTED,
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Inquiry changed; reload before quoting it',
          );
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'TAILOR_MADE_INQUIRY_QUOTED',
            entityType: 'TAILOR_MADE_INQUIRY',
            entityId: id,
            metadata: {
              oldQuotedAmountUsd: inquiry.quotedAmountUsd?.toString() ?? null,
              newQuotedAmountUsd: quotedAmount.toString(),
              notesUpdated: safeNotes !== undefined,
            },
          },
        });
        return tx.tailorMadeInquiry.findUniqueOrThrow({
          where: { id },
          select: this.inquirySelect,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async convertToBooking(id: string, actor: AuthenticatedUser) {
    const inquiry = await this.getInquiry(id);

    if (
      inquiry.status === TailorMadeInquiryStatus.CONVERTED_TO_BOOKING ||
      inquiry.bookingId
    ) {
      const existingBooking = await this.prisma.booking.findUnique({
        where: { id: inquiry.bookingId as string },
        select: this.bookingResultSelect,
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
          select: this.inquirySelect,
        });
        if (recheck?.bookingId) {
          const existingBooking = await tx.booking.findUnique({
            where: { id: recheck.bookingId },
            select: this.bookingResultSelect,
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
        select: this.bookingResultSelect,
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
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          subtotal: true,
          tax: true,
          total: true,
          currency: true,
          issuedAt: true,
        },
      });

      await tx.tailorMadeInquiry.update({
        where: { id },
        data: { bookingId: newBooking.id },
      });

      const updatedInquiry = await tx.tailorMadeInquiry.findUnique({
        where: { id },
        select: this.inquirySelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'TAILOR_MADE_INQUIRY_CONVERTED',
          entityType: 'TAILOR_MADE_INQUIRY',
          entityId: id,
          metadata: {
            bookingId: newBooking.id,
            invoiceId: newInvoice.id,
          },
        },
      });

      return {
        inquiry: updatedInquiry,
        booking: newBooking,
        invoice: newInvoice,
      };
    }, { isolationLevel: 'Serializable' });
  }
}
