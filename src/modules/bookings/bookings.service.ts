/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToursService } from '../tours/tours.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateBookingDto } from './dto';
import { BookingCreatedResponse, BookingSummaryResponse } from './types';
import { Prisma } from '@prisma/client';
import {
  generateReferenceCode,
  generateInvoiceNumber,
  extractI18n,
} from '../../common/utils';
import { BOOKING_EVENTS, BookingCreatedPayload } from '../../common/events';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toursService: ToursService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private calculateTotalAmount(
    basePriceUsd: Prisma.Decimal,
    adults: number,
    children: number,
  ): Prisma.Decimal {
    const adultTotal = basePriceUsd.mul(adults);
    const childTotal = basePriceUsd.mul(0.75).mul(children);
    return adultTotal.add(childTotal);
  }

  private async generateUniqueReferenceCode(
    attempt: number = 0,
  ): Promise<string> {
    if (attempt >= 3) {
      throw new InternalServerErrorException(
        'Unable to generate unique booking reference. Please try again.',
      );
    }
    const referenceCode = generateReferenceCode();
    const existing = await this.prisma.booking.findUnique({
      where: { referenceCode },
    });
    if (!existing) {
      return referenceCode;
    }
    this.logger.warn(
      `Reference code collision on attempt ${attempt}, retrying`,
    );
    return this.generateUniqueReferenceCode(attempt + 1);
  }

  private async generateUniqueInvoiceNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const existingCount = await tx.invoice.count({
      where: {
        invoiceNumber: { startsWith: `INV-${year}-` },
      },
    });
    const newCount = existingCount + 1;
    return generateInvoiceNumber(year, newCount);
  }

  async createBooking(
    dto: CreateBookingDto,
    userId: string | null,
  ): Promise<BookingCreatedResponse> {
    // STEP 1
    if (
      dto.billing.invoiceType === 'COMPANY' &&
      (!dto.billing.companyName || dto.billing.companyName.trim() === '')
    ) {
      throw new BadRequestException(
        'companyName is required when invoiceType is COMPANY',
      );
    }

    // STEP 2
    const tour = await this.prisma.tour.findFirst({
      where: { id: dto.tourId, isActive: true },
      select: { id: true, slug: true, titleJsonb: true, basePriceUsd: true },
    });
    if (!tour) {
      this.logger.warn(
        `Booking attempted for inactive/nonexistent tour | id=${dto.tourId}`,
      );
      throw new UnprocessableEntityException(
        'Tour is not available for booking',
      );
    }

    // STEP 3
    const totalAmountUsd = this.calculateTotalAmount(
      tour.basePriceUsd,
      dto.adults,
      dto.children ?? 0,
    );

    // STEP 4
    const referenceCode = await this.generateUniqueReferenceCode();

    // STEP 5
    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // 5a
        const booking = await tx.booking.create({
          data: {
            referenceCode,
            userId,
            tourId: tour.id,
            status: 'PENDING',
            arrivalDate: new Date(dto.arrivalDate),
            departureDate: dto.departureDate
              ? new Date(dto.departureDate)
              : null,
            transportChoice: dto.transportChoice ?? null,
            adults: dto.adults,
            children: dto.children ?? 0,
            infants: dto.infants ?? 0,
            totalAmountUsd,
            notes: dto.notes ?? null,
          },
        });

        // 5b
        await tx.passenger.createMany({
          data: dto.passengerNames.map((p) => ({
            bookingId: booking.id,
            passengerType: p.passengerType,
            fullName: p.fullName.trim(),
          })),
        });

        // 5c
        const billingInfo = await tx.billingInfo.create({
          data: {
            bookingId: booking.id,
            fullName: dto.billing.fullName.trim(),
            email: dto.billing.email.toLowerCase().trim(),
            phone: dto.billing.phone.trim(),
            invoiceType: dto.billing.invoiceType as any,
            companyName: dto.billing.companyName?.trim() ?? null,
            taxId: dto.billing.taxId?.trim() ?? null,
            address: dto.billing.address?.trim() ?? null,
            city: dto.billing.city?.trim() ?? null,
            country: dto.billing.country?.trim() ?? null,
          },
        });

        // 5d
        const invoiceNumber = await this.generateUniqueInvoiceNumber(tx);

        // 5e
        await tx.invoice.create({
          data: {
            invoiceNumber,
            bookingId: booking.id,
            issuedAt: new Date(),
          },
        });

        // 5f
        const passengers = await tx.passenger.findMany({
          where: { bookingId: booking.id },
        });

        return { booking, billingInfo, invoiceNumber, passengers };
      });
    } catch (error: any) {
      this.logger.error(
        `Booking transaction failed | ref=${referenceCode} | error=${error.message}`,
      );
      throw new InternalServerErrorException('Booking transaction failed');
    }

    // STEP 6
    const tourTitle = extractI18n(tour.titleJsonb, 'en');

    // STEP 7
    const payload: BookingCreatedPayload = {
      referenceCode,
      invoiceNumber: result.invoiceNumber,
      tourTitle,
      totalAmountUsd: totalAmountUsd.toString(),
      arrivalDate: new Date(dto.arrivalDate),
      customerEmail: dto.billing.email.toLowerCase().trim(),
      customerName: dto.billing.fullName.trim(),
      adults: dto.adults,
      children: dto.children ?? 0,
      infants: dto.infants ?? 0,
    };
    this.eventEmitter.emit(BOOKING_EVENTS.CREATED, payload);

    // STEP 8
    this.logger.log(
      `Booking created | ref=${referenceCode} invoice=${result.invoiceNumber} tour=${tour.slug} total=${totalAmountUsd.toString()}`,
    );

    return {
      id: result.booking.id,
      referenceCode: result.booking.referenceCode,
      invoiceNumber: result.invoiceNumber,
      status: result.booking.status,
      tourTitle,
      arrivalDate: result.booking.arrivalDate.toISOString().split('T')[0],
      departureDate: result.booking.departureDate
        ? result.booking.departureDate.toISOString().split('T')[0]
        : null,
      adults: result.booking.adults,
      children: result.booking.children,
      infants: result.booking.infants,
      totalAmountUsd: result.booking.totalAmountUsd.toString(),
      passengers: result.passengers.map((p) => ({
        id: p.id,
        passengerType: p.passengerType,
        fullName: p.fullName,
      })),
      billing: {
        fullName: result.billingInfo.fullName,
        email: result.billingInfo.email,
        phone: result.billingInfo.phone,
        invoiceType: result.billingInfo.invoiceType,
        companyName: result.billingInfo.companyName,
        taxId: result.billingInfo.taxId,
        address: result.billingInfo.address,
        city: result.billingInfo.city,
        country: result.billingInfo.country,
      },
    };
  }

  async findByReferenceCode(
    referenceCode: string,
  ): Promise<BookingSummaryResponse> {
    this.logger.debug(`Booking queried | ref=${referenceCode}`);

    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        tour: { select: { titleJsonb: true, slug: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking not found | ref=${referenceCode}`);
      throw new NotFoundException('Booking not found');
    }

    return {
      id: booking.id,
      referenceCode: booking.referenceCode,
      invoiceNumber: booking.invoice?.invoiceNumber ?? null,
      status: booking.status,
      tourTitle: extractI18n(booking.tour.titleJsonb, 'en'),
      tourSlug: booking.tour.slug,
      arrivalDate: booking.arrivalDate.toISOString().split('T')[0],
      departureDate: booking.departureDate
        ? booking.departureDate.toISOString().split('T')[0]
        : null,
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants,
      totalAmountUsd: booking.totalAmountUsd.toString(),
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
