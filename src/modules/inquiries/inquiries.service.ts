import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateReferenceCode } from '../../common/utils';
import {
  Prisma,
  TailorMadeInquiryStatus,
  TailorMadeInquiry,
} from '@prisma/client';
import { CreateInquiryDto, ListInquiriesQueryDto } from './dto';
import { InquiryResponse } from './types';
import { INQUIRY_EVENTS, InquiryCreatedPayload } from './events';
import { sanitizeString } from '../../common/utils/sanitize.util';

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateInquiryDto): Promise<InquiryResponse> {
    this.logger.log('Processing new tailor-made inquiry submission');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (startDate && startDate < today) {
      throw new UnprocessableEntityException(
        'Travel start date cannot be in the past',
      );
    }
    if (
      startDate &&
      endDate &&
      endDate.getTime() - startDate.getTime() > 365 * 24 * 60 * 60 * 1_000
    ) {
      throw new UnprocessableEntityException(
        'Travel duration exceeds the allowed maximum',
      );
    }

    let referenceCode = generateReferenceCode('INQ');
    let collision = true;
    let attempts = 0;

    while (collision && attempts < 5) {
      const existing = await this.prisma.tailorMadeInquiry.findUnique({
        where: { referenceCode },
        select: { id: true },
      });
      if (existing) {
        referenceCode = generateReferenceCode('INQ');
        attempts++;
      } else {
        collision = false;
      }
    }

    if (collision) {
      throw new UnprocessableEntityException(
        'Failed to generate unique reference code',
      );
    }

    let matchedCompanyId: string | null = null;
    let matchedPartnerCode: string | null = null;

    if (dto.partnerCode) {
      const cleanPartnerCode = dto.partnerCode.trim();
      const company = await this.prisma.company.findFirst({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          OR: [
            { taxId: { equals: cleanPartnerCode, mode: 'insensitive' } },
            {
              referenceCode: { equals: cleanPartnerCode, mode: 'insensitive' },
            },
            {
              referenceCode: {
                endsWith: cleanPartnerCode,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: true, taxId: true, referenceCode: true },
      });

      if (company) {
        matchedCompanyId = company.id;
        matchedPartnerCode = company.taxId || cleanPartnerCode;
      } else {
        matchedPartnerCode = cleanPartnerCode;
      }
    }

    const newInquiry = await this.prisma.tailorMadeInquiry.create({
      data: {
        referenceCode,
        fullName: sanitizeString(dto.fullName),
        email: sanitizeString(dto.email),
        phone: sanitizeString(dto.phone),
        preferredLanguage: dto.preferredLanguage,
        destinations: dto.destinations.map((d) => sanitizeString(d)),
        startDate,
        endDate,
        adults: dto.adults,
        children: dto.children,
        budgetAmount:
          dto.budgetAmount !== undefined
            ? new Prisma.Decimal(dto.budgetAmount)
            : null,
        budgetCurrency: dto.budgetCurrency || null,
        notes: sanitizeString(dto.notes || '') || null,
        partnerCode: matchedPartnerCode,
        companyId: matchedCompanyId,
        status: TailorMadeInquiryStatus.NEWLY_RECEIVED,
      },
    });

    this.logger.log(`Inquiry created successfully | ref=${referenceCode}`);

    const payload: InquiryCreatedPayload = {
      referenceCode: newInquiry.referenceCode,
      fullName: newInquiry.fullName,
      email: newInquiry.email,
      phone: newInquiry.phone,
      preferredLanguage: newInquiry.preferredLanguage,
      destinations: newInquiry.destinations,
      startDate: newInquiry.startDate
        ? newInquiry.startDate.toISOString().split('T')[0]
        : null,
      endDate: newInquiry.endDate
        ? newInquiry.endDate.toISOString().split('T')[0]
        : null,
      adults: newInquiry.adults,
      children: newInquiry.children,
      budgetAmount: newInquiry.budgetAmount
        ? newInquiry.budgetAmount.toString()
        : null,
      budgetCurrency: newInquiry.budgetCurrency,
      notes: newInquiry.notes,
      createdAt: newInquiry.createdAt.toISOString(),
    };

    this.eventEmitter.emit(INQUIRY_EVENTS.CREATED, payload);

    return this.mapToResponse(newInquiry);
  }

  async findAll(query: ListInquiriesQueryDto) {
    const { page, limit, status, createdAtStart, createdAtEnd } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TailorMadeInquiryWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (createdAtStart || createdAtEnd) {
      where.createdAt = {};
      if (createdAtStart) {
        where.createdAt.gte = new Date(createdAtStart);
      }
      if (createdAtEnd) {
        where.createdAt.lte = new Date(createdAtEnd);
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.tailorMadeInquiry.count({ where }),
      this.prisma.tailorMadeInquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: records.map((r: TailorMadeInquiry) => this.mapToResponse(r)),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(referenceCode: string): Promise<InquiryResponse> {
    const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
      where: { referenceCode },
    });

    if (!inquiry) {
      throw new NotFoundException(
        `Inquiry with reference code ${referenceCode} not found`,
      );
    }

    return this.mapToResponse(inquiry);
  }

  async updateStatus(
    referenceCode: string,
    newStatus: TailorMadeInquiryStatus,
  ): Promise<InquiryResponse> {
    if (newStatus === TailorMadeInquiryStatus.CONVERTED_TO_BOOKING) {
      throw new BadRequestException(
        'Status CONVERTED_TO_BOOKING can only be set via the dedicated /convert-to-booking endpoint.',
      );
    }

    const inquiry = await this.prisma.tailorMadeInquiry.findUnique({
      where: { referenceCode },
    });

    if (!inquiry) {
      throw new NotFoundException(
        `Inquiry with reference code ${referenceCode} not found`,
      );
    }

    if (inquiry.status === TailorMadeInquiryStatus.CLOSED) {
      this.logger.warn(
        `Rejected status update on CLOSED inquiry | ref=${referenceCode}`,
      );
      throw new UnprocessableEntityException(
        'Cannot transition a closed inquiry',
      );
    }

    if (
      inquiry.status === TailorMadeInquiryStatus.IN_PROGRESS &&
      newStatus === TailorMadeInquiryStatus.NEWLY_RECEIVED
    ) {
      this.logger.warn(
        `Rejected backward status transition | ref=${referenceCode} | to=${newStatus}`,
      );
      throw new UnprocessableEntityException(
        'Cannot move an in-progress inquiry back to newly received',
      );
    }

    const updated = await this.prisma.tailorMadeInquiry.update({
      where: { referenceCode },
      data: { status: newStatus },
    });

    this.logger.log(
      `Inquiry status updated | ref=${referenceCode} | from=${inquiry.status} | to=${newStatus}`,
    );

    return this.mapToResponse(updated);
  }

  private mapToResponse(record: TailorMadeInquiry): InquiryResponse {
    return {
      referenceCode: record.referenceCode,
      fullName: record.fullName,
      email: record.email,
      phone: record.phone,
      preferredLanguage: record.preferredLanguage,
      destinations: record.destinations,
      startDate: record.startDate
        ? record.startDate.toISOString().split('T')[0]
        : null,
      endDate: record.endDate
        ? record.endDate.toISOString().split('T')[0]
        : null,
      adults: record.adults,
      children: record.children,
      budgetAmount: record.budgetAmount ? record.budgetAmount.toString() : null,
      budgetCurrency: record.budgetCurrency,
      notes: record.notes,
      partnerCode: record.partnerCode,
      companyId: record.companyId,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
