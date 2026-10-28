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
  Optional,
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
import { CurrencyService } from '../currency/currency.service';
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
    @Optional() private readonly currencyService?: CurrencyService,
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
      nationality: dto.nationality?.trim() || null,
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');
  }

  private isP2002IdempotencyTarget(error: unknown): boolean {
    if (!error) return false;
    const err = error as {
      meta?: { target?: unknown; driverAdapterError?: unknown };
      message?: string;
    };

    // 1. Check meta.target if present
    const target = err.meta?.target;
    if (target) {
      if (Array.isArray(target)) {
        if (
          target.some(
            (t) =>
              typeof t === 'string' && t.toLowerCase().includes('idempotency'),
          )
        ) {
          return true;
        }
      } else if (
        typeof target === 'string' &&
        target.toLowerCase().includes('idempotency')
      ) {
        return true;
      }
    }

    // 2. Check error.message (Prisma formats "Unique constraint failed on the fields: (`idempotency_key`)")
    if (
      typeof err.message === 'string' &&
      err.message.toLowerCase().includes('idempotency')
    ) {
      return true;
    }

    // 3. Check driverAdapterError if present
    if (err.meta?.driverAdapterError) {
      const adapterErrStr = JSON.stringify(
        err.meta.driverAdapterError,
      ).toLowerCase();
      if (adapterErrStr.includes('idempotency')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves the current calendar date and minutes-since-midnight in an IANA timezone.
   * Falls back to UTC when the timezone identifier is unknown to the runtime.
   */
  private resolveNowInTimezone(timezone: string): {
    dateStr: string;
    minutes: number;
  } {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date());

      const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((part) => part.type === type)?.value ?? '';

      const year = get('year');
      const month = get('month');
      const day = get('day');
      // Some runtimes report midnight as hour "24" with hour12:false — normalize it.
      const hour = Number.parseInt(get('hour'), 10) % 24;
      const minute = Number.parseInt(get('minute'), 10);

      return {
        dateStr: `${year}-${month}-${day}`,
        minutes:
          (Number.isFinite(hour) ? hour : 0) * 60 +
          (Number.isFinite(minute) ? minute : 0),
      };
    } catch {
      const now = new Date();
      return {
        dateStr: now.toISOString().split('T')[0],
        minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
      };
    }
  }

  /**
   * Returns 0=Sunday .. 6=Saturday for an ISO "YYYY-MM-DD" date interpreted in the
   * given timezone. Uses a midday UTC anchor so the weekday cannot drift across
   * midnight for any timezone offset.
   */
  private resolveWeekdayInTimezone(
    dateStr: string,
    timezone: string,
  ): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
    try {
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      }).format(new Date(`${dateStr}T12:00:00Z`));

      const weekdays: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      return weekdays[weekday] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Enforces the tour's recurring dashboard-configured booking rules.
   *
   * Rules shape (Tour.bookingRulesJsonb):
   *   {
   *     enabled: boolean,
   *     dailyCutoffTime?: "HH:mm",       // same-day departures blocked after this time
   *     cutoffTimezone?: "Africa/Cairo", // defaults to Africa/Cairo (server-evaluated)
   *     blockedWeekdays?: number[],      // 0=Sunday .. 6=Saturday
   *     blockedRanges?: { start, end, reason? }[]  // inclusive YYYY-MM-DD
   *   }
   *
   * Throws UnprocessableEntityException when the tour cannot currently be booked.
   */
  private assertBookingScheduleOpen(
    tour: { bookingRulesJsonb?: unknown } | null | undefined,
    arrivalDateStr: string,
  ): void {
    const rules = (tour?.bookingRulesJsonb ?? null) as Record<
      string,
      any
    > | null;

    if (!rules || typeof rules !== 'object' || rules.enabled !== true) {
      return;
    }

    const timezone =
      typeof rules.cutoffTimezone === 'string' && rules.cutoffTimezone.trim()
        ? rules.cutoffTimezone.trim()
        : 'Africa/Cairo';

    // 1. Explicit inclusive date ranges (checked first — most specific).
    const blockedRanges = Array.isArray(rules.blockedRanges)
      ? rules.blockedRanges
      : [];
    if (arrivalDateStr && blockedRanges.length > 0) {
      for (const range of blockedRanges) {
        const start =
          typeof range?.start === 'string' ? range.start.trim() : '';
        const end = typeof range?.end === 'string' ? range.end.trim() : '';
        if (!start || !end) continue;

        if (arrivalDateStr >= start && arrivalDateStr <= end) {
          const reason =
            typeof range?.reason === 'string' && range.reason.trim()
              ? ` Reason: ${range.reason.trim()}`
              : '';
          throw new UnprocessableEntityException(
            `BOOKINGS_CLOSED: Bookings for this tour are not available for the selected date.${reason}`,
          );
        }
      }
    }

    // 2. Blocked weekdays (evaluated in the configured timezone).
    const blockedWeekdays = Array.isArray(rules.blockedWeekdays)
      ? rules.blockedWeekdays
          .map((day: unknown) => Number(day))
          .filter(
            (day: number) => Number.isInteger(day) && day >= 0 && day <= 6,
          )
      : [];
    if (blockedWeekdays.length > 0 && arrivalDateStr) {
      const weekday = this.resolveWeekdayInTimezone(arrivalDateStr, timezone);
      if (weekday !== null && blockedWeekdays.includes(weekday)) {
        throw new UnprocessableEntityException(
          'BOOKINGS_CLOSED: This tour does not operate on the selected day. Please pick another date.',
        );
      }
    }

    // 3. Daily cutoff time (blocks same-day departures after HH:mm in the configured timezone).
    const cutoffTime =
      typeof rules.dailyCutoffTime === 'string'
        ? rules.dailyCutoffTime.trim()
        : '';
    if (cutoffTime && arrivalDateStr) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(cutoffTime);
      if (match) {
        const cutoffMinutes =
          Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
        const now = this.resolveNowInTimezone(timezone);

        if (arrivalDateStr === now.dateStr && now.minutes > cutoffMinutes) {
          throw new UnprocessableEntityException(
            `BOOKINGS_CLOSED: Bookings for today close at ${cutoffTime} (${timezone}). Please select a later date.`,
          );
        }
      }
    }
  }

  async createBooking(
    dto: CreateBookingDto,
    userId?: string,
    idempotencyKey?: string,
    clientGuestToken?: string,
  ): Promise<BookingCreatedResponse> {
    this.logger.log(
      `Initiating booking creation | tourId=${dto.tourId} | user=${userId || 'GUEST'}`,
    );

    // Nationality is mandatory for real bookings (not for inquiries).
    if (dto.type === 'booking') {
      const rawNationality = (dto.nationality || '').trim();
      if (!rawNationality) {
        throw new BadRequestException(
          'NATIONALITY_REQUIRED: Nationality is required to complete the booking',
        );
      }
    }

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

    if (userId) {
      try {
        const userRecord = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isVerified: true,
            status: true,
            suspendedAt: true,
          },
        });
        const requireEmailVerification =
          this.configService.get<string | boolean>(
            'auth.requireEmailVerification',
          ) === true ||
          this.configService.get<string | boolean>(
            'auth.requireEmailVerification',
          ) === 'true';
        if (
          requireEmailVerification &&
          userRecord &&
          userRecord.isVerified === false
        ) {
          throw new ForbiddenException(
            'EMAIL_VERIFICATION_REQUIRED: Please verify your email with the 6-digit OTP code before booking a tour',
          );
        }
      } catch (err: any) {
        if (err instanceof ForbiddenException) throw err;
      }
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
        const result = await this.prisma.$transaction(
          async (tx) => {
            // 1. Load exact active, published, non-deleted tour
            const isUUID =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                dto.tourId,
              );
            let tour =
              isUUID && typeof tx.tour.findUnique === 'function'
                ? await tx.tour.findUnique({ where: { id: dto.tourId } })
                : typeof tx.tour.findFirst === 'function'
                  ? await tx.tour.findFirst({ where: { slug: dto.tourId } })
                  : null;

            if (!tour && typeof tx.tour.findUnique === 'function') {
              tour = await tx.tour.findUnique({ where: { id: dto.tourId } });
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

            // 1b. Enforce recurring booking rules (daily cutoff / blocked weekdays / date ranges)
            this.assertBookingScheduleOpen(tour, arrivalDateStr);

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
                avail.status === 'CLOSED'
              ) {
                throw new UnprocessableEntityException(
                  'Selected departure date is closed or not available for this tour',
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
              // Find or initialize scheduling slot for (tourId, arrivalDate)
              let matchedAvail = await tx.tourAvailability.findFirst({
                where: {
                  tourId: tour.id,
                  date: arrivalDateObj,
                  status: { not: 'CLOSED' },
                },
              });
              if (!matchedAvail) {
                // Auto-created departure slot default capacity. Managed via BOOKING_DEFAULT_SLOT_CAPACITY
                // env var (defaults to 50 pax per slot) instead of unbound 9999 to respect tour operations capacity planning.
                const defaultSlotCapacity = Number.isFinite(
                  parseInt(process.env.BOOKING_DEFAULT_SLOT_CAPACITY ?? '', 10),
                )
                  ? parseInt(process.env.BOOKING_DEFAULT_SLOT_CAPACITY!, 10)
                  : 50;

                matchedAvail = await tx.tourAvailability.upsert({
                  where: {
                    tourId_date: { tourId: tour.id, date: arrivalDateObj },
                  },
                  update: {},
                  create: {
                    tourId: tour.id,
                    date: arrivalDateObj,
                    totalCapacity: defaultSlotCapacity,
                    remainingSeats: defaultSlotCapacity,
                    status: 'AVAILABLE',
                  },
                });
              }
              if (matchedAvail.status === 'CLOSED') {
                throw new UnprocessableEntityException(
                  'Selected departure date is closed for bookings',
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
                accommodationId: dto.accommodationId,
                roomId: dto.roomId,
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
            const guestToken =
              clientGuestToken ||
              this.generateGuestToken(bookingId, referenceCode);
            const guestTokenHash = crypto
              .createHash('sha256')
              .update(guestToken)
              .digest('hex');

            const isZeroAmount = finalTotalAmountUsd.lte(0);
            const initialStatus: BookingStatus = 'PENDING';

            const bookingCurrency = (
              dto.currency ||
              breakdownResult.currency ||
              tour.currency ||
              'USD'
            ).toUpperCase();
            const originalAmount = new Prisma.Decimal(
              breakdownResult.authoritativeAmount ||
                breakdownResult.totalAmountUsd,
            );
            const originalCurrency = (
              breakdownResult.authoritativeCurrency || bookingCurrency
            ).toUpperCase();
            const exchangeRateDecimal = breakdownResult.exchangeRate
              ? new Prisma.Decimal(breakdownResult.exchangeRate)
              : new Prisma.Decimal(1);
            const exchangeRateDateObj = breakdownResult.exchangeRateDate
              ? new Date(breakdownResult.exchangeRateDate)
              : new Date();
            const exchangeRateDateStr =
              breakdownResult.exchangeRateDate ||
              exchangeRateDateObj.toISOString().slice(0, 10);
            const exchangeRateSourceStr =
              breakdownResult.exchangeRateSource || 'ECB';

            let convertedAmount: Prisma.Decimal;
            let convertedCurrency: string;
            if (bookingCurrency === 'EUR') {
              convertedAmount = finalTotalAmountUsd;
              convertedCurrency = 'USD';
            } else {
              convertedAmount = breakdownResult.totalAmountEur
                ? new Prisma.Decimal(breakdownResult.totalAmountEur)
                : finalTotalAmountUsd
                    .div(exchangeRateDecimal)
                    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
              convertedCurrency = 'EUR';
            }

            const booking = await tx.booking.create({
              data: {
                id: bookingId,
                referenceCode,
                userId: userId || null,
                tourId: tour.id,
                availabilityId: availIdToStore,
                arrivalDate: arrivalDateObj,
                departureDate: departureDateObj,
                status: initialStatus,
                adults: adultsCount,
                children: childrenCount,
                infants: dto.infants ?? 0,
                totalAmountUsd: finalTotalAmountUsd,
                paidAmountUsd: isZeroAmount
                  ? finalTotalAmountUsd
                  : new Prisma.Decimal(0),
                currency: bookingCurrency,
                originalAmount,
                originalCurrency,
                exchangeRate: exchangeRateDecimal,
                exchangeRateDate: exchangeRateDateStr,
                exchangeRateSource: exchangeRateSourceStr,
                convertedAmount,
                convertedCurrency,
                idempotencyKey: idempotencyKey || null,
                requestHash,
                guestTokenHash,
              },
            });

            const passengerNationality = (dto.nationality || '').trim() || null;

            const passengerData: Array<{
              bookingId: string;
              passengerType: string;
              fullName: string;
              nationality: string | null;
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
                    nationality: passengerNationality,
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
                nationality: passengerNationality,
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
                nationality: p.nationality,
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
                total:
                  bookingCurrency === 'EUR'
                    ? originalAmount
                    : finalTotalAmountUsd,
                currency: bookingCurrency,
                exchangeRate: exchangeRateDecimal,
                exchangeRateDate: exchangeRateDateStr,
                snapshotJsonb:
                  invoiceSnapshot as unknown as Prisma.InputJsonValue,
              },
            });

            if (isZeroAmount) {
              await tx.bookingActivityLog.create({
                data: {
                  bookingId: booking.id,
                  action: 'BOOKING_CREATED_CUSTOM_QUOTE',
                  details: {
                    reason:
                      'Zero-amount / custom inquiry quote requested; awaiting pricing and payment confirmation',
                    totalAmountUsd: '0.00',
                  },
                },
              });
            }

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
          },
          { maxWait: 10000, timeout: 20000 },
        );

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
          userId: userId || result.booking.userId || undefined,
        };
        this.eventEmitter.emit(BOOKING_EVENTS.CREATED, payload);

        if (result.booking.status === 'CONFIRMED') {
          this.eventEmitter.emit(BOOKING_EVENTS.CONFIRMED, {
            bookingId: result.booking.id,
            referenceCode: result.booking.referenceCode,
            customerEmail: result.billingInfo.email,
            customerName: result.billingInfo.fullName,
            tourTitle: result.tourTitle,
            totalAmountUsd: result.booking.totalAmountUsd.toString(),
            userId: userId || result.booking.userId || undefined,
          });
        }

        return responseData;
      } catch (error) {
        const errObj = error as { code?: string; meta?: { target?: unknown } };
        if (errObj?.code === 'P2002') {
          attempt++;
          if (idempotencyKey && this.isP2002IdempotencyTarget(error)) {
            let winner = null;
            for (let waitAttempt = 0; waitAttempt < 10; waitAttempt++) {
              winner = await this.prisma.booking.findUnique({
                where: { idempotencyKey },
                include: {
                  tour: { select: { titleJsonb: true } },
                  billingInfo: true,
                  invoice: { select: { invoiceNumber: true } },
                  passengers: true,
                },
              });
              if (winner && winner.billingInfo) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }

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
              const winnerGuestToken =
                clientGuestToken ||
                this.generateGuestToken(winner.id, winner.referenceCode);
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
      currency: (booking as any).currency || 'USD',
      originalAmount:
        (booking as any).originalAmount?.toString() ||
        (booking.totalAmountUsd || '0').toString(),
      originalCurrency:
        (booking as any).originalCurrency || (booking as any).currency || 'USD',
      convertedAmount:
        (booking as any).convertedAmount?.toString() || undefined,
      convertedCurrency: (booking as any).convertedCurrency || undefined,
      exchangeRate: (booking as any).exchangeRate?.toString() || undefined,
      exchangeRateDate: (booking as any).exchangeRateDate
        ? (booking as any).exchangeRateDate instanceof Date
          ? (booking as any).exchangeRateDate.toISOString()
          : String((booking as any).exchangeRateDate)
        : undefined,
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
      currency: booking.currency || 'USD',
      originalAmount: (
        booking.originalAmount ?? booking.totalAmountUsd
      ).toString(),
      originalCurrency: booking.originalCurrency || booking.currency || 'USD',
      paymentStatus: (booking.payments ?? [])[0]?.status ?? null,
      paymentAttemptId: (booking.payments ?? [])[0]?.id ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  async getInvoiceByReferenceCode(
    referenceCode: string,
    userId?: string,
    guestToken?: string,
  ) {
    const booking = (await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        tour: { select: { titleJsonb: true, slug: true } },
        invoice: true,
        billingInfo: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        payments: {
          where: { isRefund: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })) as any;

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

    if (!booking.invoice) {
      const invoiceNumber = generateInvoiceNumber();
      const totalDec = new Prisma.Decimal(booking.totalAmountUsd);
      const subtotalVal = totalDec.toFixed(2);
      const taxVal = '0.00';
      const totalAmount = totalDec.toNumber();
      const recipientName =
        booking.billingInfo?.fullName || booking.user?.name || 'Valued Guest';
      const recipientEmail =
        booking.billingInfo?.email ||
        booking.user?.email ||
        'guest@dunastravel.com';

      const snap = {
        version: 1,
        tourTitle:
          extractI18n(booking.tour?.titleJsonb, 'en') ||
          'Exclusive Luxury Tour',
        tourSlug: booking.tour?.slug || 'luxury-tour',
        arrivalDate: booking.arrivalDate.toISOString().split('T')[0],
        departureDate: booking.departureDate
          ? booking.departureDate.toISOString().split('T')[0]
          : null,
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        baseSubtotal: subtotalVal,
        tax: taxVal,
        total: totalAmount.toFixed(2),
        currency: 'USD',
        billingRecipient: {
          fullName: recipientName,
          email: recipientEmail,
          phone: booking.billingInfo?.phone || booking.user?.phone || '—',
          invoiceType: booking.billingInfo?.invoiceType || 'PERSONAL',
          companyName: booking.billingInfo?.companyName || null,
          taxId: booking.billingInfo?.taxId || null,
          address: booking.billingInfo?.address || null,
          city: booking.billingInfo?.city || null,
          country: booking.billingInfo?.country || null,
        },
      };

      const isPaid =
        booking.status === 'CONFIRMED' ||
        Number(booking.paidAmountUsd) >= totalAmount;

      const created = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          bookingId: booking.id,
          issuedAt: booking.createdAt,
          status: isPaid ? 'PAID' : 'SENT',
          subtotal: new Prisma.Decimal(subtotalVal),
          tax: new Prisma.Decimal(taxVal),
          total: new Prisma.Decimal(totalAmount.toFixed(2)),
          currency: 'USD',
          paymentId: booking.payments[0]?.id || null,
          snapshotJsonb: snap,
        },
      });

      return {
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        bookingId: booking.id,
        referenceCode: booking.referenceCode,
        issuedAt: created.issuedAt.toISOString(),
        status: created.status,
        subtotal: created.subtotal.toString(),
        tax: created.tax.toString(),
        total: created.total.toString(),
        currency: created.currency,
        tourTitle: snap.tourTitle,
        arrivalDate: snap.arrivalDate,
        departureDate: snap.departureDate,
        adults: snap.adults,
        children: snap.children,
        infants: snap.infants,
        snapshot: snap,
        billing: snap.billingRecipient,
        booking: {
          referenceCode: booking.referenceCode,
          status: booking.status,
          totalAmountUsd: booking.totalAmountUsd.toString(),
          paidAmountUsd: booking.paidAmountUsd.toString(),
        },
        payment: booking.payments[0] || null,
      };
    }

    const snap = booking.invoice.snapshotJsonb || {};

    return {
      id: booking.invoice.id,
      invoiceNumber: booking.invoice.invoiceNumber,
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      issuedAt: booking.invoice.issuedAt.toISOString(),
      status: booking.invoice.status,
      subtotal: booking.invoice.subtotal.toString(),
      tax: booking.invoice.tax.toString(),
      total: booking.invoice.total.toString(),
      currency: booking.invoice.currency,
      tourTitle: snap.tourTitle || extractI18n(booking.tour.titleJsonb, 'en'),
      arrivalDate:
        snap.arrivalDate || booking.arrivalDate.toISOString().split('T')[0],
      departureDate:
        snap.departureDate ||
        (booking.departureDate
          ? booking.departureDate.toISOString().split('T')[0]
          : null),
      adults: snap.adults ?? booking.adults,
      children: snap.children ?? booking.children,
      infants: snap.infants ?? booking.infants,
      snapshot: snap,
      billing: snap.billingRecipient || {
        fullName:
          booking.billingInfo?.fullName || booking.user?.name || 'Valued Guest',
        email: booking.billingInfo?.email || booking.user?.email || '—',
        phone: booking.billingInfo?.phone || booking.user?.phone || '—',
        invoiceType: booking.billingInfo?.invoiceType || 'PERSONAL',
        companyName: booking.billingInfo?.companyName || null,
        taxId: booking.billingInfo?.taxId || null,
        address: booking.billingInfo?.address || null,
        city: booking.billingInfo?.city || null,
        country: booking.billingInfo?.country || null,
      },
      booking: {
        referenceCode: booking.referenceCode,
        status: booking.status,
        totalAmountUsd: booking.totalAmountUsd.toString(),
        paidAmountUsd: booking.paidAmountUsd.toString(),
      },
      payment: booking.payments[0] || null,
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
      currency: b.currency || 'USD',
      originalAmount: (b.originalAmount ?? b.totalAmountUsd).toString(),
      originalCurrency: b.originalCurrency || b.currency || 'USD',
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

    // Infants do not occupy reserved capacity slots (matches reserveCapacity contract)
    const INFANTS_CONSUME_CAPACITY = false;
    const seatsToRestore = booking.adults + booking.children;

    await this.prisma.$transaction(
      async (tx) => {
        const updateResult = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: { notIn: nonCancellableStatuses },
          },
          data: {
            status: 'CANCELLED',
            cancellationReason: safeReason ?? 'Customer requested cancellation',
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
      PARTIALLY_PAID: ['CANCELLED'],
      PAID: ['COMPLETED', 'CANCELLED'],
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
      !booking.paidAmountUsd.equals(0) &&
      actor.role !== 'SUPER_ADMIN' &&
      actor.role !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Only administrators can cancel a booking with captured funds',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
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
      },
      { isolationLevel: 'Serializable' },
    );

    if (targetStatus === 'CANCELLED' || targetStatus === 'REFUNDED') {
      await this.commissionsService.reverseCommissionForBooking(booking.id);
    } else if (targetStatus === 'CONFIRMED' && booking.companyId) {
      await this.commissionsService.createCommissionForBooking(booking.id);
    }

    return result
      ? {
          ...result,
          passengers: result.passengers.map((passenger) => ({
            ...passenger,
            passportNumber: decryptSensitiveField(passenger.passportNumber),
          })),
        }
      : result;
  }

  async cancelWithRefund(
    referenceCode: string,
    actor: { id: string; role: string },
    reason?: string,
  ) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only administrators can cancel and refund bookings',
      );
    }

    const booking = await this.prisma.booking.findFirst({
      where: { referenceCode, deletedAt: null },
      include: {
        payments: {
          where: { status: 'CAPTURED' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const safeReason = reason
      ? sanitizePlainText(reason).slice(0, 2_000)
      : 'Admin cancelled with refund';

    const latestPayment = booking.payments[0];

    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Transition booking to CANCELLED
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CANCELLED',
            cancellationReason: safeReason,
          },
        });

        // 2. Release capacity if availability exists
        if (booking.availabilityId) {
          const totalPassengers = booking.adults + booking.children;
          await this.availabilityService.releaseCapacity(
            tx,
            booking.availabilityId,
            totalPassengers,
          );
        }

        // 3. Create RefundRecord if payment exists
        if (latestPayment) {
          await tx.refundRecord.create({
            data: {
              idempotencyKey: `refund:${booking.id}:${Date.now()}`,
              paymentId: latestPayment.id,
              amount: booking.paidAmountUsd,
              currency: latestPayment.currency || 'USD',
              status: 'COMPLETED',
              actorId: actor.id,
              actorRole: actor.role,
              reason: safeReason,
            },
          });

          await tx.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: 'REFUNDED',
              isRefund: true,
              refundedAt: new Date(),
            },
          });
        }

        // 4. Audit Log
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.role,
            action: 'BOOKING_CANCELLED_WITH_REFUND',
            entityType: 'BOOKING',
            entityId: booking.id,
            metadata: {
              oldStatus: booking.status,
              newStatus: 'CANCELLED',
              refundAmount: booking.paidAmountUsd.toString(),
              reason: safeReason,
            },
          },
        });

        return { success: true };
      },
      { isolationLevel: 'Serializable' },
    );

    // 5. Reverse commissions
    await this.commissionsService.reverseCommissionForBooking(booking.id);

    // 6. Emit event
    this.eventEmitter.emit(BOOKING_EVENTS.CANCELLED, {
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      reason: safeReason,
      refundedAmount: booking.paidAmountUsd.toString(),
    });

    return result;
  }
}
