import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import {
  PricingService,
  CalculatedPriceResponse,
} from '../pricing/pricing.service';
import { CommissionsService } from '../commissions/commissions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { CreateBookingDto, CalculatePriceDto } from './dto';
import { BookingCreatedResponse, BookingSummaryResponse } from './types';
import { InvoiceSnapshot } from '../invoices/types';
import { Prisma, InvoiceType, BookingStatus } from '@prisma/client';
import * as crypto from 'crypto';
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
import { decryptSensitiveField } from '../../common/security/field-encryption.util';
import { sanitizePlainText } from '../../common/utils/content-sanitizer.util';

export interface IdempotencyCacheEnvelope {
  version: number;
  userId: string | null;
  requestHash: string;
  bookingId: string;
  referenceCode: string;
  responsePayload: BookingCreatedResponse;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly guestTokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly pricingService: PricingService,
    private readonly commissionsService: CommissionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectMetric('bookings_created_total')
    private readonly bookingsCounter: Counter<string>,
  ) {
    const secret =
      this.configService.get<string>('GUEST_TOKEN_SECRET') ||
      this.configService.get<string>('auth.guestTokenSecret');
    if (!secret || secret.length < 32) {
      throw new Error(
        'FATAL: GUEST_TOKEN_SECRET must be configured with at least 32 characters',
      );
    }
    this.guestTokenSecret = secret;
  }

  generateUniqueReferenceCode(tx?: Prisma.TransactionClient): Promise<string> {
    if (tx) {
      this.logger.debug('Sequencing reference code inside transaction context');
    }
    return Promise.resolve(generateReferenceCode('BKG'));
  }

  calculateTotalAmount(
    basePrice: Prisma.Decimal,
    adults: number,
    children: number = 0,
  ): Prisma.Decimal {
    const adultTotal = basePrice.mul(adults);
    // Blueprint P1-007: Child price is 50% of adult base price
    const childTotal = basePrice.mul(0.5).mul(children);
    return adultTotal.add(childTotal);
  }

  calculatePrice(dto: CalculatePriceDto): Promise<CalculatedPriceResponse> {
    return this.pricingService.calculatePrice(dto);
  }

  private generateGuestToken(bookingId: string, referenceCode: string): string {
    return crypto
      .createHmac('sha256', this.guestTokenSecret)
      .update(`${bookingId}:${referenceCode}`)
      .digest('hex');
  }

  private hashIdempotencyKey(key: string): string {
    return `idempotency:${crypto.createHash('sha256').update(key).digest('hex')}`;
  }

  private computeRequestHash(dto: CreateBookingDto, userId?: string): string {
    const rawFullName = (dto.fullName || '').trim();
    const rawEmail = (dto.email || '').trim().toLowerCase();
    const rawPhone = (dto.phone || '').trim();

    let sortedPassengerNames: Record<string, string> | null = null;
    if (dto.passengerNames && typeof dto.passengerNames === 'object') {
      sortedPassengerNames = {};
      Object.keys(dto.passengerNames)
        .sort()
        .forEach((key) => {
          sortedPassengerNames![key] = (dto.passengerNames![key] || '').trim();
        });
    }

    const canonicalPayload = {
      userId: userId || null,
      tourId: dto.tourId,
      availabilityId: dto.availabilityId || dto.departureId || null,
      arrivalDate: dto.arrivalDate || null,
      departureDate: dto.departureDate || null,
      adults: dto.adults ?? 1,
      children: dto.children ?? 0,
      infants: dto.infants ?? 0,
      fullName: rawFullName,
      email: rawEmail,
      phone: rawPhone,
      passengerNames: sortedPassengerNames,
      promoCode: dto.promoCode?.trim().toUpperCase() || null,
      language: dto.language || 'en',
      invoiceType: dto.invoiceType || 'PERSONAL',
      companyName: dto.companyName?.trim() || null,
      taxId: dto.taxId?.trim() || null,
      address: dto.address?.trim() || null,
      city: dto.city?.trim() || null,
      country: dto.country?.trim() || null,
      transportChoice: dto.transportChoice?.trim() || null,
      notes: dto.notes?.trim() || null,
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');
  }

  private isP2002IdempotencyTarget(target: unknown): boolean {
    if (!target) return false;
    if (Array.isArray(target)) {
      return target.some(
        (t) =>
          typeof t === 'string' &&
          (t.includes('idempotency') || t.includes('idempotency_key')),
      );
    }
    if (typeof target === 'string') {
      return (
        target.includes('idempotency') || target.includes('idempotency_key')
      );
    }
    return false;
  }

  async createBooking(
    dto: CreateBookingDto,
    userId?: string,
    idempotencyKey?: string,
  ): Promise<BookingCreatedResponse> {
    this.logger.log(`Initiating booking creation | tourId=${dto.tourId} | user=${userId || 'GUEST'}`);

    if (!idempotencyKey) {
      idempotencyKey = `bkg_auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    if (dto.passengerNames) {
      const entries = Object.entries(dto.passengerNames);
      if (
        entries.length > 120 ||
        entries.some(
          ([key, value]) =>
            !/^(adult|child|infant)_\d{1,3}$/i.test(key) ||
            typeof value !== 'string' ||
            value.trim().length < 1 ||
            value.trim().length > 255,
        )
      ) {
        throw new BadRequestException('Invalid passenger roster');
      }
    }

    if (
      idempotencyKey.length > 100 ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(idempotencyKey)
    ) {
      throw new BadRequestException('Invalid idempotency key');
    }

    const requestHash = this.computeRequestHash(dto, userId);

    {
      const cacheKey = this.hashIdempotencyKey(idempotencyKey);
      const cachedEnvelope =
        await this.cacheManager.get<IdempotencyCacheEnvelope>(cacheKey);

      if (
        cachedEnvelope &&
        typeof cachedEnvelope === 'object' &&
        cachedEnvelope.version === 1
      ) {
        if (cachedEnvelope.userId !== (userId || null)) {
          throw new UnprocessableEntityException(
            'Idempotency key belongs to another user',
          );
        }
        if (cachedEnvelope.requestHash !== requestHash) {
          throw new UnprocessableEntityException(
            'Idempotency key reused with mismatched request payload',
          );
        }
        return cachedEnvelope.responsePayload;
      }

      const existingBooking = await this.prisma.booking.findUnique({
        where: { idempotencyKey },
        include: {
          tour: { select: { titleJsonb: true } },
          billingInfo: true,
          invoice: { select: { invoiceNumber: true } },
          passengers: true,
        },
      });

      if (existingBooking) {
        if (existingBooking.userId !== (userId || null)) {
          throw new UnprocessableEntityException(
            'Idempotency key belongs to another user',
          );
        }
        if (
          !existingBooking.requestHash ||
          existingBooking.requestHash !== requestHash
        ) {
          throw new UnprocessableEntityException(
            'Idempotency key reused with mismatched request payload',
          );
        }
        const guestToken = !userId
          ? this.generateGuestToken(
              existingBooking.id,
              existingBooking.referenceCode,
            )
          : null;
        return this.buildCreatedResponse(
          existingBooking,
          existingBooking.billingInfo!,
          existingBooking.invoice?.invoiceNumber ?? null,
          existingBooking.passengers,
          extractI18n(
            existingBooking.tour?.titleJsonb || { en: 'Tour' },
            dto.language || 'en',
          ),
          guestToken,
        );
      }
    }

    const rawFullName = (dto.fullName || '').trim();
    const rawEmail = (dto.email || '').trim().toLowerCase();
    const rawPhone = (dto.phone || '').trim();

    if (!rawFullName || !rawEmail || !rawPhone) {
      throw new BadRequestException(
        'Billing information (fullName, email, phone) is required',
      );
    }

    if (!dto.arrivalDate) {
      throw new BadRequestException(
        'Arrival date is required for tour bookings',
      );
    }

    const arrivalDateObj = new Date(dto.arrivalDate);
    if (isNaN(arrivalDateObj.getTime())) {
      throw new BadRequestException('Invalid arrival date format');
    }

    const arrivalDateStr = arrivalDateObj.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    if (arrivalDateStr < todayStr) {
      throw new BadRequestException('Arrival date cannot be in the past');
    }

    let departureDateObj: Date | null = null;
    if (dto.departureDate) {
      departureDateObj = new Date(dto.departureDate);
      if (isNaN(departureDateObj.getTime())) {
        throw new BadRequestException('Invalid departure date format');
      }
      const departureDateStr = departureDateObj.toISOString().split('T')[0];
      if (departureDateStr < arrivalDateStr) {
        throw new BadRequestException(
          'Departure date cannot be before arrival date',
        );
      }
    }

    const adultsCount = dto.adults ?? 1;
    const childrenCount = dto.children ?? 0;
    const totalPassengers = adultsCount + childrenCount;

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          // 1. Load exact active, published, non-deleted tour
          const isUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              dto.tourId,
            );
          let tour = isUUID && typeof tx.tour.findUnique === 'function'
            ? await tx.tour.findUnique({ where: { id: dto.tourId } })
            : null;

          if (!tour && typeof tx.tour.findUnique === 'function') {
            tour = await tx.tour.findUnique({ where: { id: dto.tourId } });
          }

          if (!tour && !isUUID && typeof tx.tour.findFirst === 'function') {
            tour = await tx.tour.findFirst({ where: { slug: dto.tourId } });
          }

          if (
            !tour ||
            tour.status !== 'PUBLISHED' ||
            !tour.isActive ||
            tour.deletedAt !== null
          ) {
            throw new UnprocessableEntityException(
              'Tour is not available for booking',
            );
          }

          // 2. Resolve & Validate Availability
          const availId = dto.availabilityId || dto.departureId;
          let availIdToStore: string;

          if (availId) {
            const avail = await tx.tourAvailability.findUnique({
              where: { id: availId },
            });
            if (
              !avail ||
              avail.tourId !== tour.id ||
              !['AVAILABLE', 'LIMITED'].includes(avail.status) ||
              avail.remainingSeats < totalPassengers
            ) {
              throw new UnprocessableEntityException(
                'Selected availability is not available or has insufficient seats',
              );
            }
            const availDate = new Date(avail.date);
            const availDateStr = `${availDate.getUTCFullYear()}-${String(availDate.getUTCMonth() + 1).padStart(2, '0')}-${String(availDate.getUTCDate()).padStart(2, '0')}`;
            if (availDateStr !== arrivalDateStr) {
              throw new UnprocessableEntityException(
                'Selected availability slot date does not match arrival date',
              );
            }
            availIdToStore = avail.id;
          } else {
            // Find unique slot by (tourId, arrivalDate)
            const matchedAvail = await tx.tourAvailability.findFirst({
              where: {
                tourId: tour.id,
                date: arrivalDateObj,
                status: { in: ['AVAILABLE', 'LIMITED'] },
                remainingSeats: { gte: totalPassengers },
              },
            });
            if (!matchedAvail) {
              throw new UnprocessableEntityException(
                'No bookable availability slot found for the selected tour and date',
              );
            }
            availIdToStore = matchedAvail.id;
          }

          // 3. Calculate price against PRE-reservation state
          const breakdownResult = await this.pricingService.calculatePrice(
            {
              tourId: tour.id,
              availabilityId: availIdToStore,
              date: arrivalDateStr,
              adults: adultsCount,
              children: childrenCount,
              infants: dto.infants ?? 0,
              promoCode: dto.promoCode,
              language: dto.language,
            },
            tx,
          );

          if (dto.promoCode && !breakdownResult.promoValid) {
            throw new BadRequestException(
              breakdownResult.promoMessage || 'Invalid or expired promo code',
            );
          }

          const finalTotalAmountUsd = new Prisma.Decimal(
            breakdownResult.totalAmountUsd,
          );

          // 4. Acquire promotion quota conditionally inside transaction
          let promoToRedeem: { id: string; discount: Prisma.Decimal } | null =
            null;
          if (
            dto.promoCode &&
            breakdownResult.promoValid &&
            breakdownResult.discounts &&
            breakdownResult.discounts.length > 0
          ) {
            const codeUpper = dto.promoCode.trim().toUpperCase();
            const promo = await tx.promotion.findFirst({
              where: {
                code: codeUpper,
                isActive: true,
                validFrom: { lte: new Date() },
                validUntil: { gte: new Date() },
              },
            });

            if (!promo) {
              throw new BadRequestException('Invalid or expired promo code');
            }

            const updatedPromo = await tx.promotion.updateMany({
              where: {
                id: promo.id,
                currentUses: { lt: promo.maxUses },
                isActive: true,
                validFrom: { lte: new Date() },
                validUntil: { gte: new Date() },
              },
              data: {
                currentUses: { increment: 1 },
              },
            });

            if (updatedPromo.count === 0) {
              throw new BadRequestException(
                'Promotion code usage limit reached',
              );
            }

            promoToRedeem = {
              id: promo.id,
              discount: new Prisma.Decimal(
                breakdownResult.discounts[0].amountUsd,
              ),
            };
          }

          // 5. Atomically reserve capacity
          await this.availabilityService.reserveCapacity(
            tx,
            availIdToStore,
            totalPassengers,
          );

          // 6. Create booking, passengers, billing, redemption, invoice
          const referenceCode = await this.generateUniqueReferenceCode(tx);
          const bookingId = crypto.randomUUID();
          const guestToken = !userId
            ? this.generateGuestToken(bookingId, referenceCode)
            : null;
          const guestTokenHash = guestToken
            ? crypto.createHash('sha256').update(guestToken).digest('hex')
            : null;

          const booking = await tx.booking.create({
            data: {
              id: bookingId,
              referenceCode,
              userId: userId || null,
              tourId: tour.id,
              availabilityId: availIdToStore,
              arrivalDate: arrivalDateObj,
              departureDate: departureDateObj,
              adults: adultsCount,
              children: childrenCount,
              infants: dto.infants ?? 0,
              totalAmountUsd: finalTotalAmountUsd,
              idempotencyKey: idempotencyKey || null,
              requestHash,
              guestTokenHash,
            },
          });

          const passengerData: Array<{
            bookingId: string;
            passengerType: string;
            fullName: string;
          }> = [];

          if (dto.passengerNames && typeof dto.passengerNames === 'object') {
            let adultKeysCount = 0;
            let childKeysCount = 0;
            let infantKeysCount = 0;

            for (const [key, name] of Object.entries(dto.passengerNames)) {
              if (name && typeof name === 'string' && name.trim()) {
                let type = 'ADULT';
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('child')) {
                  type = 'CHILD';
                  childKeysCount++;
                } else if (lowerKey.includes('infant')) {
                  type = 'INFANT';
                  infantKeysCount++;
                } else {
                  adultKeysCount++;
                }
                passengerData.push({
                  bookingId: booking.id,
                  passengerType: type,
                  fullName: name.trim(),
                });
              }
            }

            if (
              adultKeysCount !== adultsCount ||
              childKeysCount !== childrenCount ||
              infantKeysCount !== (dto.infants ?? 0)
            ) {
              throw new BadRequestException(
                'Passenger roster counts do not match declared adult/child/infant counts',
              );
            }
          }

          if (passengerData.length === 0) {
            passengerData.push({
              bookingId: booking.id,
              passengerType: 'ADULT',
              fullName: rawFullName,
            });
          }

          await tx.passenger.createMany({ data: passengerData });

          const invType = dto.invoiceType || InvoiceType.PERSONAL;
          const billingInfo = await tx.billingInfo.create({
            data: {
              bookingId: booking.id,
              fullName: rawFullName,
              email: rawEmail,
              phone: rawPhone,
              invoiceType: invType as InvoiceType,
              companyName: dto.companyName || null,
              taxId: dto.taxId || null,
              address: dto.address || null,
              city: dto.city || null,
              country: dto.country || null,
            },
          });

          const invoiceNumber = await generateInvoiceNumber(tx);
          const subtotalUsd =
            breakdownResult.subtotalUsd ?? breakdownResult.basePriceUsd ?? 0;
          const invoiceSnapshot: InvoiceSnapshot = {
            version: 1,
            tourId: tour.id,
            tourTitle: extractI18n(tour.titleJsonb, dto.language || 'en'),
            tourSlug: tour.slug,
            arrivalDate: arrivalDateStr,
            departureDate: departureDateObj
              ? departureDateObj.toISOString().split('T')[0]
              : null,
            adults: adultsCount,
            children: childrenCount,
            infants: dto.infants ?? 0,
            baseSubtotal: subtotalUsd,
            adultTotal: breakdownResult.adultTotalUsd,
            childTotal: breakdownResult.childTotalUsd,
            seasonalAdjustment: breakdownResult.seasonalAdjustmentUsd,
            discounts: (breakdownResult.discounts || []).map((d) => ({
              name: d.name,
              amount: d.amountUsd,
              code: d.code,
            })),
            tax: breakdownResult.taxAmountUsd || '0.00',
            total: breakdownResult.totalAmountUsd,
            currency: breakdownResult.currency || 'USD',
            billingRecipient: {
              fullName: billingInfo.fullName,
              email: billingInfo.email,
              phone: billingInfo.phone,
              invoiceType: billingInfo.invoiceType,
              companyName: billingInfo.companyName,
              taxId: billingInfo.taxId,
              address: billingInfo.address,
              city: billingInfo.city,
              country: billingInfo.country,
            },
            passengers: passengerData.map((p) => ({
              passengerType: p.passengerType,
              fullName: p.fullName,
            })),
          };

          await tx.invoice.create({
            data: {
              invoiceNumber,
              bookingId: booking.id,
              issuedAt: new Date(),
              status: 'SENT',
              subtotal: new Prisma.Decimal(subtotalUsd),
              tax: new Prisma.Decimal(breakdownResult.taxAmountUsd || 0),
              total: finalTotalAmountUsd,
              currency: breakdownResult.currency || 'USD',
              snapshotJsonb:
                invoiceSnapshot as unknown as Prisma.InputJsonValue,
            },
          });

          if (promoToRedeem) {
            await tx.promotionRedemption.create({
              data: {
                bookingId: booking.id,
                promotionId: promoToRedeem.id,
                userId: userId ?? null,
                discount: promoToRedeem.discount,
                status: 'ACTIVE',
              },
            });
          }

          const passengers = await tx.passenger.findMany({
            where: { bookingId: booking.id },
          });

          return {
            booking,
            billingInfo,
            invoiceNumber,
            passengers,
            tourTitle: extractI18n(tour.titleJsonb, dto.language || 'en'),
            guestToken,
          };
        });

        this.bookingsCounter.inc();

        const responseData = this.buildCreatedResponse(
          result.booking,
          result.billingInfo,
          result.invoiceNumber,
          result.passengers,
          result.tourTitle,
          result.guestToken,
        );

        {
          const cacheKey = this.hashIdempotencyKey(idempotencyKey);
          const envelope: IdempotencyCacheEnvelope = {
            version: 1,
            userId: userId || null,
            requestHash,
            bookingId: result.booking.id,
            referenceCode: result.booking.referenceCode,
            responsePayload: responseData,
          };
          await this.cacheManager.set(cacheKey, envelope, 86400000);
        }

        const payload: BookingCreatedPayload = {
          referenceCode: result.booking.referenceCode,
          invoiceNumber: result.invoiceNumber,
          customerEmail: result.billingInfo.email,
          customerName: result.billingInfo.fullName,
          tourTitle: result.tourTitle,
          arrivalDate: result.booking.arrivalDate,
          totalAmountUsd: result.booking.totalAmountUsd.toString(),
          adults: adultsCount,
          children: childrenCount,
          infants: dto.infants ?? 0,
        };
        this.eventEmitter.emit(BOOKING_EVENTS.CREATED, payload);

        return responseData;
      } catch (error) {
        const errObj = error as { code?: string; meta?: { target?: unknown } };
        if (errObj?.code === 'P2002') {
          attempt++;
          if (
            idempotencyKey &&
            this.isP2002IdempotencyTarget(errObj.meta?.target)
          ) {
            const winner = await this.prisma.booking.findUnique({
              where: { idempotencyKey },
              include: {
                tour: { select: { titleJsonb: true } },
                billingInfo: true,
                invoice: { select: { invoiceNumber: true } },
                passengers: true,
              },
            });
            if (winner) {
              if (winner.userId !== (userId || null)) {
                throw new UnprocessableEntityException(
                  'Idempotency key belongs to another user',
                );
              }
              if (!winner.requestHash || winner.requestHash !== requestHash) {
                throw new UnprocessableEntityException(
                  'Idempotency key reused with mismatched request payload',
                );
              }
              const winnerGuestToken = !userId
                ? this.generateGuestToken(winner.id, winner.referenceCode)
                : null;
              return this.buildCreatedResponse(
                winner,
                winner.billingInfo!,
                winner.invoice?.invoiceNumber ?? null,
                winner.passengers,
                extractI18n(
                  winner.tour?.titleJsonb || { en: 'Tour' },
                  dto.language || 'en',
                ),
                winnerGuestToken,
              );
            }
          }
          if (attempt >= maxAttempts) {
            throw new InternalServerErrorException(
              'Could not generate unique booking reference after multiple attempts.',
            );
          }
        } else {
          throw error;
        }
      }
    }

    throw new InternalServerErrorException('Booking creation failed');
  }

  private buildCreatedResponse(
    booking: {
      id: string;
      referenceCode?: string;
      status?: string;
      arrivalDate?: Date | null;
      departureDate?: Date | null;
      adults?: number;
      children?: number;
      infants?: number;
      totalAmountUsd?: Prisma.Decimal | string;
    },
    billingInfo: {
      fullName: string;
      email: string;
      phone: string;
      invoiceType: string;
      companyName?: string | null;
      taxId?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    },
    invoiceNumber: string | null,
    passengers: Array<{ id: string; passengerType: string; fullName: string }>,
    tourTitle: string,
    guestToken: string | null,
  ): BookingCreatedResponse {
    const arrDate = booking.arrivalDate
      ? booking.arrivalDate instanceof Date
        ? booking.arrivalDate.toISOString().split('T')[0]
        : String(booking.arrivalDate).split('T')[0]
      : new Date().toISOString().split('T')[0];

    const depDate = booking.departureDate
      ? booking.departureDate instanceof Date
        ? booking.departureDate.toISOString().split('T')[0]
        : String(booking.departureDate).split('T')[0]
      : null;

    return {
      id: booking.id,
      referenceCode: booking.referenceCode || 'BKG-REPLAY',
      invoiceNumber: invoiceNumber || '',
      status: booking.status || 'PENDING',
      tourTitle,
      arrivalDate: arrDate,
      departureDate: depDate,
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
      infants: booking.infants ?? 0,
      totalAmountUsd: (booking.totalAmountUsd || '0').toString(),
      paymentRequired: Number(booking.totalAmountUsd || 0) > 0,
      passengers: (passengers || []).map((p) => ({
        id: p.id,
        passengerType: p.passengerType,
        fullName: p.fullName,
      })),
      billing: {
        fullName: billingInfo?.fullName || '',
        email: billingInfo?.email || '',
        phone: billingInfo?.phone || '',
        invoiceType: billingInfo?.invoiceType || 'PERSONAL',
        companyName: billingInfo?.companyName || null,
        taxId: billingInfo?.taxId || null,
        address: billingInfo?.address || null,
        city: billingInfo?.city || null,
        country: billingInfo?.country || null,
      },
      guestToken,
    };
  }

  async findByReferenceCode(
    referenceCode: string,
    userId?: string,
    guestToken?: string,
  ): Promise<BookingSummaryResponse> {
    this.logger.debug(`Booking queried | ref=${referenceCode}`);

    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        tour: { select: { titleJsonb: true, slug: true } },
        invoice: { select: { invoiceNumber: true } },
        billingInfo: { select: { email: true } },
        payments: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking not found | ref=${referenceCode}`);
      throw new NotFoundException('Booking not found');
    }

    let authorized = false;
    if (userId && booking.userId === userId) {
      authorized = true;
    } else if (guestToken && booking.guestTokenHash) {
      const computedHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      const hashBufferA = Buffer.from(computedHash, 'utf8');
      const hashBufferB = Buffer.from(booking.guestTokenHash, 'utf8');
      if (
        hashBufferA.length === hashBufferB.length &&
        crypto.timingSafeEqual(hashBufferA, hashBufferB)
      ) {
        authorized = true;
      }
    }

    if (!authorized) {
      this.logger.warn(
        `Unauthorized access attempt for booking | ref=${referenceCode}`,
      );
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
      paymentStatus: (booking.payments ?? [])[0]?.status ?? null,
      paymentAttemptId: (booking.payments ?? [])[0]?.id ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  async findUserBookings(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<BookingSummaryResponse>> {
    const { skip, take } = getPaginationParams(page, limit);
    const [total, bookings] = await Promise.all([
      this.prisma.booking.count({ where: { userId, deletedAt: null } }),
      this.prisma.booking.findMany({
        where: { userId, deletedAt: null },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          tour: { select: { titleJsonb: true, slug: true } },
          invoice: { select: { invoiceNumber: true } },
          payments: {
            where: { isRefund: false },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true },
          },
        },
      }),
    ]);

    const items: BookingSummaryResponse[] = bookings.map((b) => ({
      id: b.id,
      referenceCode: b.referenceCode,
      invoiceNumber: b.invoice?.invoiceNumber ?? null,
      status: b.status,
      tourTitle: extractI18n(b.tour.titleJsonb, 'en'),
      tourSlug: b.tour.slug,
      arrivalDate: b.arrivalDate.toISOString().split('T')[0],
      departureDate: b.departureDate
        ? b.departureDate.toISOString().split('T')[0]
        : null,
      adults: b.adults,
      children: b.children,
      infants: b.infants,
      totalAmountUsd: b.totalAmountUsd.toString(),
      paymentStatus: (b.payments ?? [])[0]?.status ?? null,
      paymentAttemptId: (b.payments ?? [])[0]?.id ?? null,
      createdAt: b.createdAt.toISOString(),
    }));

    return paginate(items, total, page, limit);
  }

  async cancelBooking(
    referenceCode: string,
    userId?: string,
    reason?: string,
    guestToken?: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Initiating booking cancellation | ref=${referenceCode}`);

    const safeReason = reason
      ? sanitizePlainText(reason).slice(0, 2_000)
      : undefined;
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        billingInfo: { select: { email: true } },
        promotionRedemption: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let authorized = false;
    if (userId && booking.userId === userId) {
      authorized = true;
    } else if (guestToken && booking.guestTokenHash) {
      const computedHash = crypto
        .createHash('sha256')
        .update(guestToken)
        .digest('hex');
      const hashBufferA = Buffer.from(computedHash, 'utf8');
      const hashBufferB = Buffer.from(booking.guestTokenHash, 'utf8');
      if (
        hashBufferA.length === hashBufferB.length &&
        crypto.timingSafeEqual(hashBufferA, hashBufferB)
      ) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw new NotFoundException('Booking not found');
    }

    const nonCancellableStatuses: BookingStatus[] = [
      'CANCELLED',
      'COMPLETED',
      'PAID',
      'PARTIALLY_PAID',
      'REFUNDED',
      'ARCHIVED',
    ];
    if (nonCancellableStatuses.includes(booking.status)) {
      throw new BadRequestException(
        `Booking cannot be cancelled in status: ${booking.status}`,
      );
    }

    const seatsToRestore = booking.adults + booking.children;

    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: { notIn: nonCancellableStatuses },
        },
        data: {
          status: 'CANCELLED',
          cancellationReason:
            safeReason ?? 'Customer requested cancellation',
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          `Booking cannot be cancelled in status: ${booking.status}`,
        );
      }

      if (booking.availabilityId) {
        await this.availabilityService.releaseCapacity(
          tx,
          booking.availabilityId,
          seatsToRestore,
        );
      }

      if (
        booking.promotionRedemption &&
        booking.promotionRedemption.status === 'ACTIVE'
      ) {
        const redemptionUpdate = await tx.promotionRedemption.updateMany({
          where: {
            id: booking.promotionRedemption.id,
            status: 'ACTIVE',
          },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
          },
        });

        if (redemptionUpdate.count > 0) {
          await tx.promotion.updateMany({
            where: {
              id: booking.promotionRedemption.promotionId,
              currentUses: { gt: 0 },
            },
            data: {
              currentUses: { decrement: 1 },
            },
          });
        }
      }

      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: userId || null,
          action: 'BOOKING_CANCELLED_BY_CUSTOMER',
          details: {
            actorType: userId ? 'AUTHENTICATED_USER' : 'GUEST_TOKEN',
            reasonProvided: Boolean(safeReason),
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    this.logger.log(`Booking successfully cancelled | ref=${referenceCode}`);
    return { message: 'Booking cancelled successfully' };
  }

  async transitionBookingStatus(
    referenceCode: string,
    targetStatus: string,
    actor: { id: string; role: string },
    reason?: string,
  ) {
    this.logger.log(
      `Transitioning booking status | ref=${referenceCode} targetStatus=${targetStatus} actorRole=${actor.role}`,
    );

    const safeReason = reason
      ? sanitizePlainText(reason).slice(0, 2_000)
      : undefined;
    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        promotionRedemption: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (actor.role === 'AGENT' && booking.assigneeId !== actor.id) {
      throw new ForbiddenException('Agents can only update assigned bookings');
    }

    if (booking.status === targetStatus) {
      throw new ConflictException(
        `Booking is already in status ${targetStatus}`,
      );
    }

    const financialStatuses = ['PAID', 'PARTIALLY_PAID', 'REFUNDED'];
    if (financialStatuses.includes(targetStatus)) {
      throw new ForbiddenException(
        'Financial booking status is controlled by the payment ledger',
      );
    }

    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['CANCELLED'],
      PARTIALLY_PAID: [],
      PAID: ['COMPLETED'],
      COMPLETED: ['ARCHIVED'],
      CANCELLED: ['CONFIRMED', 'PENDING', 'ARCHIVED'],
      REFUNDED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowed = validTransitions[booking.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `Cannot transition booking status from ${booking.status} to ${targetStatus}`,
      );
    }

    if (actor.role === 'AGENT') {
      const restrictedStatuses = ['PAID', 'REFUNDED'];
      if (
        restrictedStatuses.includes(targetStatus) ||
        restrictedStatuses.includes(booking.status)
      ) {
        throw new ForbiddenException(
          'Agents cannot perform financial status transitions',
        );
      }
    }

    const totalPassengers = booking.adults + booking.children;
    if (
      targetStatus === 'CANCELLED' &&
      !booking.paidAmountUsd.equals(0)
    ) {
      throw new ForbiddenException(
        'A booking with captured funds must use the refund workflow',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (targetStatus === 'CANCELLED') {
        const updateResult = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: booking.status,
          },
          data: {
            status: 'CANCELLED',
            cancellationReason:
              safeReason ?? 'Status transitioned to CANCELLED',
          },
        });

        if (updateResult.count === 0) {
          throw new BadRequestException(
            `Booking cannot be cancelled in status ${booking.status}`,
          );
        }

        if (booking.availabilityId) {
          await this.availabilityService.releaseCapacity(
            tx,
            booking.availabilityId,
            totalPassengers,
          );
        }

        if (
          booking.promotionRedemption &&
          booking.promotionRedemption.status === 'ACTIVE'
        ) {
          const redemptionUpdate = await tx.promotionRedemption.updateMany({
            where: {
              id: booking.promotionRedemption.id,
              status: 'ACTIVE',
            },
            data: {
              status: 'REVERSED',
              reversedAt: new Date(),
            },
          });

          if (redemptionUpdate.count > 0) {
            await tx.promotion.updateMany({
              where: {
                id: booking.promotionRedemption.promotionId,
                currentUses: { gt: 0 },
              },
              data: {
                currentUses: { decrement: 1 },
              },
            });
          }
        }
      } else if (
        booking.status === 'CANCELLED' &&
        ['CONFIRMED', 'PENDING'].includes(targetStatus)
      ) {
        if (booking.availabilityId) {
          const avail = await tx.tourAvailability.findUnique({
            where: { id: booking.availabilityId },
          });

          if (
            !avail ||
            !['AVAILABLE', 'LIMITED'].includes(avail.status) ||
            avail.remainingSeats < totalPassengers
          ) {
            throw new UnprocessableEntityException(
              'Capacity is no longer available to restore this booking',
            );
          }

          await this.availabilityService.reserveCapacity(
            tx,
            booking.availabilityId,
            totalPassengers,
          );
        }

        if (
          booking.promotionRedemption &&
          booking.promotionRedemption.status === 'REVERSED'
        ) {
          const promo = await tx.promotion.findUnique({
            where: { id: booking.promotionRedemption.promotionId },
          });

          if (promo && promo.isActive && promo.currentUses < promo.maxUses) {
            await tx.promotion.update({
              where: { id: promo.id },
              data: { currentUses: { increment: 1 } },
            });
            await tx.promotionRedemption.update({
              where: { id: booking.promotionRedemption.id },
              data: { status: 'ACTIVE', reversedAt: null },
            });
          } else {
            throw new UnprocessableEntityException(
              'Promotion quota is no longer available to restore this booking discount',
            );
          }
        }

        const restored = await tx.booking.updateMany({
          where: { id: booking.id, status: booking.status },
          data: {
            status: targetStatus as any,
            cancellationReason: null,
          },
        });
        if (restored.count !== 1) {
          throw new BadRequestException(
            'Booking changed; reload before restoring it',
          );
        }
      } else {
        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: booking.status },
          data: {
            status: targetStatus as any,
            ...(safeReason && { cancellationReason: safeReason }),
          },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            'Booking changed; reload before updating it',
          );
        }
      }

      await tx.bookingActivityLog.create({
        data: {
          bookingId: booking.id,
          userId: actor.id,
          action:
            booking.status === 'CANCELLED'
              ? 'BOOKING_RESTORED'
              : 'STATUS_CHANGED',
          details: {
            oldStatus: booking.status,
            newStatus: targetStatus,
            reason: safeReason ?? null,
            actorRole: actor.role,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'BOOKING_STATUS_CHANGED',
          entityType: 'BOOKING',
          entityId: booking.id,
          metadata: {
            oldStatus: booking.status,
            newStatus: targetStatus,
          },
        },
      });

      const updatedBooking = await tx.booking.findUnique({
        where: { id: booking.id },
        select: {
          id: true,
          referenceCode: true,
          userId: true,
          tourId: true,
          status: true,
          arrivalDate: true,
          departureDate: true,
          adults: true,
          children: true,
          infants: true,
          totalAmountUsd: true,
          paidAmountUsd: true,
          cancellationReason: true,
          priority: true,
          assigneeId: true,
          createdAt: true,
          updatedAt: true,
          passengers: {
            select: {
              id: true,
              passengerType: true,
              fullName: true,
              dateOfBirth: true,
              nationality: true,
              passportExpiry: true,
              passportNumber: true,
            },
          },
          billingInfo: {
            select: {
              fullName: true,
              email: true,
              phone: true,
              invoiceType: true,
              companyName: true,
              taxId: true,
              address: true,
              city: true,
              country: true,
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
            },
          },
          tour: { select: { id: true, slug: true, titleJsonb: true } },
        },
      });

      return updatedBooking;
    }, { isolationLevel: 'Serializable' });

    if (targetStatus === 'CANCELLED' || targetStatus === 'REFUNDED') {
      await this.commissionsService.reverseCommissionForBooking(booking.id);
    }

    return result
      ? {
          ...result,
          passengers: result.passengers.map((passenger) => ({
            ...passenger,
            passportNumber: decryptSensitiveField(
              passenger.passportNumber,
            ),
          })),
        }
      : result;
  }
}
