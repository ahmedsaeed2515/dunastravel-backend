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
  getPaginationParams,
  paginate,
  PaginatedResponse,
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
    const crypto = require('crypto');
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    const year = new Date().getFullYear();
    const seqResult = await tx.$queryRaw<
      [{ nextval: bigint }]
    >`SELECT nextval('invoice_seq')`;
    const num = Number(seqResult[0].nextval);
    return `INV-${year}-${String(num).padStart(4, '0')}-${randomPart}`;
  }

  async calculatePrice(dto: any) {
    const tour = await this.prisma.tour.findFirst({
      where: { id: dto.tourId, isActive: true },
      select: { basePriceUsd: true },
    });
    if (!tour) throw new NotFoundException('Tour not found or inactive');

    let totalAmountUsd = this.calculateTotalAmount(
      tour.basePriceUsd,
      dto.adults,
      dto.children || 0,
    );

    let discountAmountUsd = new Prisma.Decimal(0);
    let promoValid = false;
    let promoMessage = '';

    if (dto.promoCode) {
      const promo = await this.prisma.promotion.findUnique({ where: { code: dto.promoCode } });
      if (promo && promo.isActive) {
        const now = new Date();
        const valid = (!promo.validFrom || now >= promo.validFrom) && 
                      (!promo.validUntil || now <= promo.validUntil) && 
                      (promo.maxUses === null || promo.currentUses < promo.maxUses);
        if (valid) {
          discountAmountUsd = totalAmountUsd.mul(promo.discountPercent).div(100);
          totalAmountUsd = totalAmountUsd.sub(discountAmountUsd);
          if (totalAmountUsd.lt(0)) totalAmountUsd = new Prisma.Decimal(0);
          promoValid = true;
          promoMessage = 'Promo applied successfully';
        } else {
          promoMessage = 'Promo code expired or max uses reached';
        }
      } else {
        promoMessage = 'Invalid promo code';
      }
    }

    return {
      totalAmountUsd: totalAmountUsd.toString(),
      discountAmountUsd: discountAmountUsd.toString(),
      basePriceUsd: tour.basePriceUsd.toString(),
      promoValid,
      promoMessage
    };
  }

  async createBooking(
    dto: any,
    userId: string | null,
    idempotencyKey?: string,
    adminOverride: boolean = false
  ): Promise<any> {
    if (idempotencyKey) {
      const cachedResponse = await this.cacheManager.get<any>(`idempotency:${idempotencyKey}`);
      if (cachedResponse) return cachedResponse;
    }

    // We remove the hard requirement for taxId/companyName and auto-create the company below if missing

    const tours = await this.prisma.tour.findMany({ where: { isActive: true }, select: { id: true, slug: true, titleJsonb: true, basePriceUsd: true } });
    const tour = tours.find(t => {
      const titleEn = extractI18n(t.titleJsonb, 'en');
      return titleEn && titleEn.toLowerCase() === dto.tourTitle?.toLowerCase();
    });

    if (!tour && !adminOverride) {
      this.logger.warn(`Booking attempted for non-existent tour title: ${dto.tourTitle}`);
      throw new UnprocessableEntityException('Tour is not available for booking');
    }

    if (dto.type === 'inquiry') {
      const referenceCode = await this.generateUniqueReferenceCode();
      const booking = await this.prisma.booking.create({
        data: {
          referenceCode,
          userId,
          tourId: tour?.id || tours[0]?.id || 'uuid-placeholder',
          status: 'PENDING',
          bookingType: 'INQUIRY',
          arrivalDate: new Date(),
          totalAmountUsd: 0,
          inquiryMessage: dto.inquiryMessage,
          language: dto.language,
          adults: 0,
          children: 0,
          infants: 0
        },
      });

      const billingInfo = await this.prisma.billingInfo.create({
        data: {
          bookingId: booking.id,
          fullName: dto.fullName?.trim() || 'Inquiry User',
          email: dto.email?.toLowerCase().trim() || 'noemail@example.com',
          phone: dto.phone?.trim() || '00000',
          invoiceType: 'PERSONAL',
        },
      });
      return { id: booking.id, referenceCode: booking.referenceCode, type: 'inquiry', status: 'RECEIVED' };
    }

    const adultsCount = adminOverride ? (dto.passengers || 1) : (dto.adults || 1);
    const childrenCount = adminOverride ? 0 : (dto.children ?? 0);
    // Date corruption fix: If arrivalDate is missing but departureDate is provided, 
    // it implies the user selected the start date of the tour in the UI (which they sent as departureDate).
    const arrivalDate = dto.arrivalDate 
      ? new Date(dto.arrivalDate) 
      : (dto.departureDate ? new Date(dto.departureDate) : new Date());

    let totalAmountUsd = adminOverride && dto.manualAmountUsd !== undefined
      ? new Prisma.Decimal(dto.manualAmountUsd)
      : this.calculateTotalAmount(tour?.basePriceUsd || new Prisma.Decimal(0), adultsCount, childrenCount);

    const referenceCode = await this.generateUniqueReferenceCode();
    let result;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        result = await this.prisma.$transaction(async (tx) => {
          const seatsRequested = adultsCount + childrenCount;
          if (!adminOverride && tour) {
            const seatUpdate = await tx.tour.updateMany({
              where: { id: tour.id, remainingSeats: { gte: seatsRequested } },
              data: { remainingSeats: { decrement: seatsRequested } },
            });
            if (seatUpdate.count === 0) {
              throw new UnprocessableEntityException('Tour is fully booked or has insufficient seats');
            }
          }

          let companyId = null;
          if (dto.invoiceType === 'company') {
            const taxId = dto.taxId?.trim();
            if (taxId) {
              const company = await tx.company.findFirst({ where: { taxId } });
              if (company) {
                 companyId = company.id;
              } else {
                 // Auto-create an unverified 'CORPORATE' profile
                 const newCompany = await tx.company.create({
                   data: { 
                     referenceCode: generateReferenceCode(), 
                     name: dto.companyName?.trim() || 'Unknown Corporate', 
                     email: dto.email, 
                     phone: dto.phone, 
                     taxId, 
                     companyType: 'CORPORATE',
                     status: 'INACTIVE'
                   }
                 });
                 companyId = newCompany.id;
              }
            } else if (dto.companyName) {
              const company = await tx.company.findFirst({ where: { name: { equals: dto.companyName.trim(), mode: 'insensitive' } } });
              if (company) {
                 companyId = company.id;
              } else {
                 const newCompany = await tx.company.create({
                   data: { 
                     referenceCode: generateReferenceCode(), 
                     name: dto.companyName.trim(), 
                     email: dto.email, 
                     phone: dto.phone, 
                     companyType: 'CORPORATE',
                     status: 'INACTIVE'
                   }
                 });
                 companyId = newCompany.id;
              }
            }
          }

          const booking = await tx.booking.create({
            data: {
              referenceCode,
              userId,
              companyId,
              tourId: tour?.id || tours[0]?.id || 'uuid-placeholder',
              status: adminOverride && dto.status ? dto.status : 'PENDING',
              bookingType: 'BOOKING',
              arrivalDate: arrivalDate,
              departureDate: dto.departureDate ? new Date(dto.departureDate) : null,
              arrivalTime: dto.arrivalTime ?? null,
              departureTime: dto.departureTime ?? null,
              language: dto.language ?? null,
              activityType: dto.activityType ?? null,
              transportChoice: dto.transportChoice ?? null,
              adults: adultsCount,
              children: childrenCount,
              infants: dto.infants ?? 0,
              totalAmountUsd,
              notes: dto.notes ?? null,
            },
          });

          let passengerData = [];
          if (dto.passengerNames) {
             for (const [key, name] of Object.entries(dto.passengerNames)) {
                let type = 'ADULT';
                if (key.includes('child')) type = 'CHILD';
                if (key.includes('infant')) type = 'INFANT';
                passengerData.push({ bookingId: booking.id, passengerType: type, fullName: name as string });
             }
          }
          if (passengerData.length > 0) {
             await tx.passenger.createMany({ data: passengerData });
          }

          const billingInfo = await tx.billingInfo.create({
            data: {
              bookingId: booking.id,
              fullName: dto.fullName?.trim() || 'Override',
              email: dto.email?.toLowerCase().trim() || 'admin@override.com',
              phone: dto.phone?.trim() || '00000',
              invoiceType: dto.invoiceType === 'company' ? 'COMPANY' : 'PERSONAL',
              companyName: dto.companyName?.trim() ?? null,
              taxId: dto.taxId?.trim() ?? null,
              address: dto.address?.trim() ?? null,
              city: dto.city?.trim() ?? null,
              country: dto.country?.trim() ?? null,
            },
          });

          const invoiceNumber = await this.generateUniqueInvoiceNumber(tx);
          await tx.invoice.create({ data: { invoiceNumber, bookingId: booking.id, issuedAt: new Date() } });
          const passengers = await tx.passenger.findMany({ where: { bookingId: booking.id } });

          return { booking, billingInfo, invoiceNumber, passengers };
        });
        break;
      } catch (error: any) {
        if (error.code === 'P2002' && error.meta?.target?.includes('invoiceNumber')) {
          attempt++;
          continue;
        }
        throw error;
      }
    }

    if (!result) throw new InternalServerErrorException('Booking transaction failed');

    const tourTitle = tour ? extractI18n(tour.titleJsonb, 'en') : dto.tourTitle;

    const payload = {
      referenceCode,
      invoiceNumber: result.invoiceNumber,
      tourTitle,
      totalAmountUsd: totalAmountUsd.toString(),
      arrivalDate: arrivalDate,
      customerEmail: dto.email?.toLowerCase().trim(),
      customerName: dto.fullName?.trim(),
      adults: dto.adults,
      children: dto.children ?? 0,
      infants: dto.infants ?? 0,
    };
    this.eventEmitter.emit(BOOKING_EVENTS.CREATED, payload);

    this.bookingsCounter.inc();

    const responseData = {
      id: result.booking.id,
      referenceCode: result.booking.referenceCode,
      invoiceNumber: result.invoiceNumber,
      type: 'booking',
      status: result.booking.status,
      tourTitle,
      arrivalDate: result.booking.arrivalDate.toISOString().split('T')[0],
      departureDate: result.booking.departureDate ? result.booking.departureDate.toISOString().split('T')[0] : null,
      adults: result.booking.adults,
      children: result.booking.children,
      infants: result.booking.infants,
      totalAmountUsd: result.booking.totalAmountUsd.toString(),
      passengers: result.passengers.map((p: any) => ({ id: p.id, passengerType: p.passengerType, fullName: p.fullName })),
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
      await this.cacheManager.set(`idempotency:${idempotencyKey}`, responseData, 86400000);
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

  async findUserBookings(
    userId: string,
    pageVal: number = 1,
    limitVal: number = 10,
  ): Promise<PaginatedResponse<BookingSummaryResponse>> {
    this.logger.debug(`User bookings queried | userId=${userId}`);
    const { skip, take, page, limit } = getPaginationParams(pageVal, limitVal);

    const [total, records] = await this.prisma.$transaction([
      this.prisma.booking.count({ where: { userId } }),
      this.prisma.booking.findMany({
        where: { userId },
        include: {
          tour: { select: { titleJsonb: true, slug: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const data = records.map((booking) => ({
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

    return paginate(data, total, page, limit);
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
