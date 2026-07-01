"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
var common_1 = require("@nestjs/common");
var utils_1 = require("../../common/utils");
var events_1 = require("../../common/events");
var BookingsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var BookingsService = _classThis = /** @class */ (function () {
        function BookingsService_1(prisma, toursService, eventEmitter, bookingsCounter, cacheManager) {
            this.prisma = prisma;
            this.toursService = toursService;
            this.eventEmitter = eventEmitter;
            this.bookingsCounter = bookingsCounter;
            this.cacheManager = cacheManager;
            this.logger = new common_1.Logger(BookingsService.name);
        }
        BookingsService_1.prototype.calculateTotalAmount = function (basePriceUsd, adults, children) {
            var adultTotal = basePriceUsd.mul(adults);
            var childTotal = basePriceUsd.mul(0.75).mul(children);
            return adultTotal.add(childTotal);
        };
        BookingsService_1.prototype.generateUniqueReferenceCode = function () {
            return __awaiter(this, arguments, void 0, function (attempt) {
                var referenceCode, existing;
                if (attempt === void 0) { attempt = 0; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (attempt >= 3) {
                                throw new common_1.InternalServerErrorException('Unable to generate unique booking reference. Please try again.');
                            }
                            referenceCode = (0, utils_1.generateReferenceCode)();
                            return [4 /*yield*/, this.prisma.booking.findUnique({
                                    where: { referenceCode: referenceCode },
                                })];
                        case 1:
                            existing = _a.sent();
                            if (!existing) {
                                return [2 /*return*/, referenceCode];
                            }
                            this.logger.warn("Reference code collision on attempt ".concat(attempt, ", retrying"));
                            return [2 /*return*/, this.generateUniqueReferenceCode(attempt + 1)];
                    }
                });
            });
        };
        BookingsService_1.prototype.generateUniqueInvoiceNumber = function (tx) {
            return __awaiter(this, void 0, void 0, function () {
                var year, seqResult, num;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            year = new Date().getFullYear();
                            return [4 /*yield*/, tx.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["SELECT nextval('invoice_seq')"], ["SELECT nextval('invoice_seq')"])))];
                        case 1:
                            seqResult = _a.sent();
                            num = Number(seqResult[0].nextval);
                            return [2 /*return*/, "INV-".concat(year, "-").concat(String(num).padStart(4, '0'))];
                    }
                });
            });
        };
        BookingsService_1.prototype.createBooking = function (dto, userId, idempotencyKey) {
            return __awaiter(this, void 0, void 0, function () {
                var cachedResponse, tour, totalAmountUsd, referenceCode, result, attempt, maxAttempts, error_1, tourTitle, payload, responseData;
                var _this = this;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            if (!idempotencyKey) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.cacheManager.get("idempotency:".concat(idempotencyKey))];
                        case 1:
                            cachedResponse = _f.sent();
                            if (cachedResponse) {
                                this.logger.log("Idempotency key hit for ".concat(idempotencyKey, ", returning cached booking response"));
                                return [2 /*return*/, cachedResponse];
                            }
                            _f.label = 2;
                        case 2:
                            // STEP 1
                            if (dto.billing.invoiceType === 'COMPANY' &&
                                (!dto.billing.companyName || dto.billing.companyName.trim() === '')) {
                                throw new common_1.BadRequestException('companyName is required when invoiceType is COMPANY');
                            }
                            return [4 /*yield*/, this.prisma.tour.findFirst({
                                    where: { id: dto.tourId, isActive: true },
                                    select: { id: true, slug: true, titleJsonb: true, basePriceUsd: true },
                                })];
                        case 3:
                            tour = _f.sent();
                            if (!tour) {
                                this.logger.warn("Booking attempted for inactive/nonexistent tour | id=".concat(dto.tourId));
                                throw new common_1.UnprocessableEntityException('Tour is not available for booking');
                            }
                            totalAmountUsd = this.calculateTotalAmount(tour.basePriceUsd, dto.adults, (_a = dto.children) !== null && _a !== void 0 ? _a : 0);
                            return [4 /*yield*/, this.generateUniqueReferenceCode()];
                        case 4:
                            referenceCode = _f.sent();
                            attempt = 0;
                            maxAttempts = 3;
                            _f.label = 5;
                        case 5:
                            if (!(attempt < maxAttempts)) return [3 /*break*/, 10];
                            _f.label = 6;
                        case 6:
                            _f.trys.push([6, 8, , 9]);
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var seatsRequested, seatUpdate, booking, billingInfo, invoiceNumber, passengers;
                                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                                    return __generator(this, function (_r) {
                                        switch (_r.label) {
                                            case 0:
                                                seatsRequested = dto.adults + ((_a = dto.children) !== null && _a !== void 0 ? _a : 0);
                                                return [4 /*yield*/, tx.tour.updateMany({
                                                        where: {
                                                            id: tour.id,
                                                            remainingSeats: { gte: seatsRequested },
                                                        },
                                                        data: { remainingSeats: { decrement: seatsRequested } },
                                                    })];
                                            case 1:
                                                seatUpdate = _r.sent();
                                                if (seatUpdate.count === 0) {
                                                    throw new common_1.UnprocessableEntityException('Tour is fully booked or has insufficient seats');
                                                }
                                                return [4 /*yield*/, tx.booking.create({
                                                        data: {
                                                            referenceCode: referenceCode,
                                                            userId: userId,
                                                            tourId: tour.id,
                                                            status: 'PENDING',
                                                            arrivalDate: new Date(dto.arrivalDate),
                                                            departureDate: dto.departureDate
                                                                ? new Date(dto.departureDate)
                                                                : null,
                                                            transportChoice: (_b = dto.transportChoice) !== null && _b !== void 0 ? _b : null,
                                                            adults: dto.adults,
                                                            children: (_c = dto.children) !== null && _c !== void 0 ? _c : 0,
                                                            infants: (_d = dto.infants) !== null && _d !== void 0 ? _d : 0,
                                                            totalAmountUsd: totalAmountUsd,
                                                            notes: (_e = dto.notes) !== null && _e !== void 0 ? _e : null,
                                                        },
                                                    })];
                                            case 2:
                                                booking = _r.sent();
                                                // 5c
                                                return [4 /*yield*/, tx.passenger.createMany({
                                                        data: dto.passengerNames.map(function (p) { return ({
                                                            bookingId: booking.id,
                                                            passengerType: p.passengerType,
                                                            fullName: p.fullName.trim(),
                                                        }); }),
                                                    })];
                                            case 3:
                                                // 5c
                                                _r.sent();
                                                return [4 /*yield*/, tx.billingInfo.create({
                                                        data: {
                                                            bookingId: booking.id,
                                                            fullName: dto.billing.fullName.trim(),
                                                            email: dto.billing.email.toLowerCase().trim(),
                                                            phone: dto.billing.phone.trim(),
                                                            invoiceType: dto.billing.invoiceType,
                                                            companyName: (_g = (_f = dto.billing.companyName) === null || _f === void 0 ? void 0 : _f.trim()) !== null && _g !== void 0 ? _g : null,
                                                            taxId: (_j = (_h = dto.billing.taxId) === null || _h === void 0 ? void 0 : _h.trim()) !== null && _j !== void 0 ? _j : null,
                                                            address: (_l = (_k = dto.billing.address) === null || _k === void 0 ? void 0 : _k.trim()) !== null && _l !== void 0 ? _l : null,
                                                            city: (_o = (_m = dto.billing.city) === null || _m === void 0 ? void 0 : _m.trim()) !== null && _o !== void 0 ? _o : null,
                                                            country: (_q = (_p = dto.billing.country) === null || _p === void 0 ? void 0 : _p.trim()) !== null && _q !== void 0 ? _q : null,
                                                        },
                                                    })];
                                            case 4:
                                                billingInfo = _r.sent();
                                                return [4 /*yield*/, this.generateUniqueInvoiceNumber(tx)];
                                            case 5:
                                                invoiceNumber = _r.sent();
                                                // 5f
                                                return [4 /*yield*/, tx.invoice.create({
                                                        data: {
                                                            invoiceNumber: invoiceNumber,
                                                            bookingId: booking.id,
                                                            issuedAt: new Date(),
                                                        },
                                                    })];
                                            case 6:
                                                // 5f
                                                _r.sent();
                                                return [4 /*yield*/, tx.passenger.findMany({
                                                        where: { bookingId: booking.id },
                                                    })];
                                            case 7:
                                                passengers = _r.sent();
                                                return [2 /*return*/, { booking: booking, billingInfo: billingInfo, invoiceNumber: invoiceNumber, passengers: passengers }];
                                        }
                                    });
                                }); })];
                        case 7:
                            result = _f.sent();
                            return [3 /*break*/, 10]; // Success, exit retry loop
                        case 8:
                            error_1 = _f.sent();
                            if (error_1.code === 'P2002' &&
                                ((_c = (_b = error_1.meta) === null || _b === void 0 ? void 0 : _b.target) === null || _c === void 0 ? void 0 : _c.includes('invoiceNumber'))) {
                                attempt++;
                                this.logger.warn("Invoice number collision, retrying attempt ".concat(attempt));
                                if (attempt >= maxAttempts) {
                                    throw new common_1.InternalServerErrorException('Booking transaction failed due to invoice collision');
                                }
                                return [3 /*break*/, 5];
                            }
                            this.logger.error("Booking transaction failed | ref=".concat(referenceCode, " | error=").concat(error_1.message));
                            throw new common_1.InternalServerErrorException('Booking transaction failed');
                        case 9: return [3 /*break*/, 5];
                        case 10:
                            // STEP 6
                            if (!result) {
                                throw new common_1.InternalServerErrorException('Booking transaction failed');
                            }
                            tourTitle = (0, utils_1.extractI18n)(tour.titleJsonb, 'en');
                            payload = {
                                referenceCode: referenceCode,
                                invoiceNumber: result.invoiceNumber,
                                tourTitle: tourTitle,
                                totalAmountUsd: totalAmountUsd.toString(),
                                arrivalDate: new Date(dto.arrivalDate),
                                customerEmail: dto.billing.email.toLowerCase().trim(),
                                customerName: dto.billing.fullName.trim(),
                                adults: dto.adults,
                                children: (_d = dto.children) !== null && _d !== void 0 ? _d : 0,
                                infants: (_e = dto.infants) !== null && _e !== void 0 ? _e : 0,
                            };
                            this.eventEmitter.emit(events_1.BOOKING_EVENTS.CREATED, payload);
                            // STEP 8
                            this.logger.log("Booking created | ref=".concat(referenceCode, " invoice=").concat(result.invoiceNumber, " tour=").concat(tour.slug, " total=").concat(totalAmountUsd.toString()));
                            this.bookingsCounter.inc();
                            responseData = {
                                id: result.booking.id,
                                referenceCode: result.booking.referenceCode,
                                invoiceNumber: result.invoiceNumber,
                                status: result.booking.status,
                                tourTitle: tourTitle,
                                arrivalDate: result.booking.arrivalDate.toISOString().split('T')[0],
                                departureDate: result.booking.departureDate
                                    ? result.booking.departureDate.toISOString().split('T')[0]
                                    : null,
                                adults: result.booking.adults,
                                children: result.booking.children,
                                infants: result.booking.infants,
                                totalAmountUsd: result.booking.totalAmountUsd.toString(),
                                passengers: result.passengers.map(function (p) { return ({
                                    id: p.id,
                                    passengerType: p.passengerType,
                                    fullName: p.fullName,
                                }); }),
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
                            if (!idempotencyKey) return [3 /*break*/, 12];
                            return [4 /*yield*/, this.cacheManager.set("idempotency:".concat(idempotencyKey), responseData, 86400000)];
                        case 11:
                            _f.sent();
                            _f.label = 12;
                        case 12: return [2 /*return*/, responseData];
                    }
                });
            });
        };
        BookingsService_1.prototype.findByReferenceCode = function (referenceCode, email, userId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, authorized;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            this.logger.debug("Booking queried | ref=".concat(referenceCode));
                            return [4 /*yield*/, this.prisma.booking.findUnique({
                                    where: { referenceCode: referenceCode },
                                    include: {
                                        tour: { select: { titleJsonb: true, slug: true } },
                                        invoice: { select: { invoiceNumber: true } },
                                        billingInfo: { select: { email: true } },
                                    },
                                })];
                        case 1:
                            booking = _d.sent();
                            if (!booking) {
                                this.logger.warn("Booking not found | ref=".concat(referenceCode));
                                throw new common_1.NotFoundException('Booking not found');
                            }
                            authorized = false;
                            if (userId && booking.userId === userId) {
                                authorized = true;
                            }
                            else if (email &&
                                ((_a = booking.billingInfo) === null || _a === void 0 ? void 0 : _a.email.toLowerCase()) === email.toLowerCase()) {
                                authorized = true;
                            }
                            if (!authorized) {
                                this.logger.warn("Unauthorized access attempt for booking | ref=".concat(referenceCode));
                                // Return 404 to prevent enumeration
                                throw new common_1.NotFoundException('Booking not found');
                            }
                            return [2 /*return*/, {
                                    id: booking.id,
                                    referenceCode: booking.referenceCode,
                                    invoiceNumber: (_c = (_b = booking.invoice) === null || _b === void 0 ? void 0 : _b.invoiceNumber) !== null && _c !== void 0 ? _c : null,
                                    status: booking.status,
                                    tourTitle: (0, utils_1.extractI18n)(booking.tour.titleJsonb, 'en'),
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
                                }];
                    }
                });
            });
        };
        BookingsService_1.prototype.findUserBookings = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                var bookings;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug("User bookings queried | userId=".concat(userId));
                            return [4 /*yield*/, this.prisma.booking.findMany({
                                    where: { userId: userId },
                                    include: {
                                        tour: { select: { titleJsonb: true, slug: true } },
                                        invoice: { select: { invoiceNumber: true } },
                                    },
                                    orderBy: { createdAt: 'desc' },
                                })];
                        case 1:
                            bookings = _a.sent();
                            return [2 /*return*/, bookings.map(function (booking) {
                                    var _a, _b;
                                    return ({
                                        id: booking.id,
                                        referenceCode: booking.referenceCode,
                                        invoiceNumber: (_b = (_a = booking.invoice) === null || _a === void 0 ? void 0 : _a.invoiceNumber) !== null && _b !== void 0 ? _b : null,
                                        status: booking.status,
                                        tourTitle: (0, utils_1.extractI18n)(booking.tour.titleJsonb, 'en'),
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
                                    });
                                })];
                    }
                });
            });
        };
        BookingsService_1.prototype.cancelBooking = function (referenceCode, userId, reason) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, nonCancellableStatuses, seatsToRestore;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({
                                where: { referenceCode: referenceCode },
                                include: { billingInfo: { select: { email: true } } },
                            })];
                        case 1:
                            booking = _a.sent();
                            if (!booking) {
                                throw new common_1.NotFoundException('Booking not found');
                            }
                            if (booking.userId !== userId) {
                                // Return 404 to avoid enumeration
                                throw new common_1.NotFoundException('Booking not found');
                            }
                            nonCancellableStatuses = ['CANCELLED', 'COMPLETED', 'NO_SHOW'];
                            if (nonCancellableStatuses.includes(booking.status)) {
                                throw new common_1.BadRequestException("Booking cannot be cancelled in status: ".concat(booking.status));
                            }
                            seatsToRestore = booking.adults + booking.children;
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.booking.update({
                                                    where: { id: booking.id },
                                                    data: {
                                                        status: 'CANCELLED',
                                                        cancellationReason: reason !== null && reason !== void 0 ? reason : 'Customer requested cancellation',
                                                    },
                                                })];
                                            case 1:
                                                _a.sent();
                                                // Restore seats atomically
                                                return [4 /*yield*/, tx.tour.updateMany({
                                                        where: { id: booking.tourId },
                                                        data: { remainingSeats: { increment: seatsToRestore } },
                                                    })];
                                            case 2:
                                                // Restore seats atomically
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 2:
                            _a.sent();
                            this.logger.log("Booking cancelled | ref=".concat(referenceCode, " by userId=").concat(userId));
                            return [2 /*return*/, { message: 'Booking cancelled successfully' }];
                    }
                });
            });
        };
        return BookingsService_1;
    }());
    __setFunctionName(_classThis, "BookingsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BookingsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BookingsService = _classThis;
}();
exports.BookingsService = BookingsService;
var templateObject_1;
