/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toursService: ToursService,
    private readonly eventEmitter: EventEmitter2,
    @InjectMetric('bookings_created_total')
    private readonly bookingsCounter: Counter<string>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

  private async generateUniqueInvoiceNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const seqResult = await tx.$queryRaw<
      [{ nextval: bigint }]
    >`SELECT nextval('invoice_seq')`;
    const num = Number(seqResult[0].nextval);
    return `INV-${year}-${String(num).padStart(4, '0')}`;
  }

  async createBooking(
    dto: CreateBookingDto,
    userId: string | null,
    idempotencyKey?: string,
  ): Promise<BookingCreatedResponse> {
    if (idempotencyKey) {
      const cachedResponse =
        await this.cacheManager.get<BookingCreatedResponse>(
          `idempotency:${idempotencyKey}`,
        );
      if (cachedResponse) {
        this.logger.log(
          `Idempotency key hit for ${idempotencyKey}, returning cached booking response`,
        );
        return cachedResponse;
      }
    }

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
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        result = await this.prisma.$transaction(async (tx) => {
          // 5a — Atomic seat decrement (prevents overselling under concurrency)
          const seatsRequested = dto.adults + (dto.children ?? 0);
          const seatUpdate = await tx.tour.updateMany({
            where: {
              id: tour.id,
              remainingSeats: { gte: seatsRequested },
            },
            data: { remainingSeats: { decrement: seatsRequested } },
          });
          if (seatUpdate.count === 0) {
            throw new UnprocessableEntityException(
              'Tour is fully booked or has insufficient seats',
            );
          }

          // 5b
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

          // 5c
          await tx.passenger.createMany({
            data: dto.passengerNames.map((p) => ({
              bookingId: booking.id,
              passengerType: p.passengerType,
              fullName: p.fullName.trim(),
            })),
          });

          // 5d
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

          // 5e
          const invoiceNumber = await this.generateUniqueInvoiceNumber(tx);

          // 5f
          await tx.invoice.create({
            data: {
              invoiceNumber,
              bookingId: booking.id,
              issuedAt: new Date(),
            },
          });

          // 5g
          const passengers = await tx.passenger.findMany({
            where: { bookingId: booking.id },
          });

          return { booking, billingInfo, invoiceNumber, passengers };
        });

        break; // Success, exit retry loop
      } catch (error: any) {
        if (
          error.code === 'P2002' &&
          error.meta?.target?.includes('invoiceNumber')
        ) {
          attempt++;
          this.logger.warn(
            `Invoice number collision, retrying attempt ${attempt}`,
          );
          if (attempt >= maxAttempts) {
            throw new InternalServerErrorException(
              'Booking transaction failed due to invoice collision',
            );
          }
          continue;
        }

        this.logger.error(
          `Booking transaction failed | ref=${referenceCode} | error=${error.message}`,
        );
        throw new InternalServerErrorException('Booking transaction failed');
      }
    }

    // STEP 6
    if (!result) {
      throw new InternalServerErrorException('Booking transaction failed');
    }
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
    this.bookingsCounter.inc();

    const responseData = {
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

    if (idempotencyKey) {
      await this.cacheManager.set(
        `idempotency:${idempotencyKey}`,
        responseData,
        86400000,
      );
    }

    return responseData;
  }

  async findByReferenceCode(
    referenceCode: string,
    email?: string,
    userId?: string,
  ): Promise<BookingSummaryResponse> {
    this.logger.debug(`Booking queried | ref=${referenceCode}`);

    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
      include: {
        tour: { select: { titleJsonb: true, slug: true } },
        invoice: { select: { invoiceNumber: true } },
        billingInfo: { select: { email: true } },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking not found | ref=${referenceCode}`);
      throw new NotFoundException('Booking not found');
    }

    // IDOR / Enumeration Mitigation
    let authorized = false;
    if (userId && booking.userId === userId) {
      authorized = true;
    } else if (
      email &&
      booking.billingInfo?.email.toLowerCase() === email.toLowerCase()
    ) {
      authorized = true;
    }

    if (!authorized) {
      this.logger.warn(
        `Unauthorized access attempt for booking | ref=${referenceCode}`,
      );
      // Return 404 to prevent enumeration
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

  async findUserBookings(userId: string): Promise<BookingSummaryResponse[]> {
    this.logger.debug(`User bookings queried | userId=${userId}`);
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        tour: { select: { titleJsonb: true, slug: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((booking) => ({
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
    }));
  }

  async cancelBooking(
    referenceCode: string,
    userId: string,
    reason?: string,
  ): Promise<{ message: string }> {
    const booking = await this.prisma.booking.findUnique({
      where: { referenceCode },
      include: { billingInfo: { select: { email: true } } },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      // Return 404 to avoid enumeration
      throw new NotFoundException('Booking not found');
    }

    const nonCancellableStatuses = ['CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (nonCancellableStatuses.includes(booking.status as string)) {
      throw new BadRequestException(
        `Booking cannot be cancelled in status: ${booking.status}`,
      );
    }

    const seatsToRestore = booking.adults + booking.children;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED' as any,
          cancellationReason: reason ?? 'Customer requested cancellation',
        },
      });

      // Restore seats atomically
      await tx.tour.updateMany({
        where: { id: booking.tourId },
        data: { remainingSeats: { increment: seatsToRestore } },
      });
    });

    this.logger.log(`Booking cancelled | ref=${referenceCode} by userId=${userId}`);

    return { message: 'Booking cancelled successfully' };
  }
}
