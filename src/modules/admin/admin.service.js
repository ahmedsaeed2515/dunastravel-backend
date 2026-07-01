"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
/* eslint-disable */
var common_1 = require("@nestjs/common");
var AdminService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AdminService = _classThis = /** @class */ (function () {
        function AdminService_1(prisma, cacheManager) {
            this.prisma = prisma;
            this.cacheManager = cacheManager;
            this.logger = new common_1.Logger(AdminService.name);
        }
        AdminService_1.prototype.listBookings = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, status, tourId, dateFrom, dateTo, search, paymentStatus, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, status = query.status, tourId = query.tourId, dateFrom = query.dateFrom, dateTo = query.dateTo, search = query.search, paymentStatus = query.paymentStatus, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("listBookings invoked by admin ".concat(adminUserId, " with filters: ").concat(JSON.stringify(query)));
                            where = { deletedAt: null };
                            if (query.includeDeleted === 'true' || query.includeDeleted === true) {
                                delete where.deletedAt;
                            }
                            if (status)
                                where.status = status;
                            if (paymentStatus && !status)
                                where.status = paymentStatus;
                            if (tourId)
                                where.tourId = tourId;
                            if (dateFrom || dateTo) {
                                where.createdAt = {};
                                if (dateFrom)
                                    where.createdAt.gte = new Date(dateFrom);
                                if (dateTo)
                                    where.createdAt.lte = new Date(dateTo);
                            }
                            if (search) {
                                where.OR = [
                                    { referenceCode: { contains: search, mode: 'insensitive' } },
                                    { billingInfo: { fullName: { contains: search, mode: 'insensitive' } } },
                                    { billingInfo: { email: { contains: search, mode: 'insensitive' } } },
                                ];
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.booking.count({ where: where }),
                                    this.prisma.booking.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                        include: {
                                            invoice: { select: { invoiceNumber: true } },
                                            _count: { select: { passengers: true } },
                                            tour: { select: { id: true, slug: true, titleJsonb: true } },
                                        },
                                    }),
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (b) {
                                var _a;
                                var titleObj = b.tour.titleJsonb || {};
                                var tourNameEn = titleObj['en'] || 'Unknown';
                                return {
                                    id: b.id,
                                    referenceCode: b.referenceCode,
                                    status: b.status,
                                    totalAmount: b.totalAmountUsd.toString(),
                                    currency: 'USD',
                                    passengerCount: b._count.passengers,
                                    tourId: b.tour.id,
                                    tourSlug: b.tour.slug,
                                    tourNameEn: tourNameEn,
                                    invoiceNumber: ((_a = b.invoice) === null || _a === void 0 ? void 0 : _a.invoiceNumber) || null,
                                    createdAt: b.createdAt,
                                };
                            });
                            return [2 /*return*/, {
                                    data: data,
                                    total: total,
                                    page: page,
                                    limit: limit,
                                    totalPages: Math.ceil(total / limit),
                                }];
                    }
                });
            });
        };
        AdminService_1.prototype.getBookingByReferenceCode = function (referenceCode, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var b, titleObj, tourNameEn;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            this.logger.log("getBookingByReferenceCode invoked by admin ".concat(adminUserId, " for Ref: ").concat(referenceCode));
                            return [4 /*yield*/, this.prisma.booking.findUnique({
                                    where: { referenceCode: referenceCode },
                                    include: {
                                        passengers: true,
                                        billingInfo: true,
                                        invoice: true,
                                        tour: { select: { id: true, slug: true, titleJsonb: true } },
                                        payments: true,
                                        activityLogs: { orderBy: { createdAt: 'desc' } },
                                        notesList: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
                                        attachments: true,
                                    }
                                })];
                        case 1:
                            b = _b.sent();
                            if (!b)
                                throw new common_1.NotFoundException("Booking with reference ".concat(referenceCode, " not found"));
                            titleObj = b.tour.titleJsonb || {};
                            tourNameEn = titleObj['en'] || 'Unknown';
                            return [2 /*return*/, {
                                    id: b.id,
                                    referenceCode: b.referenceCode,
                                    status: b.status,
                                    totalAmount: b.totalAmountUsd.toString(),
                                    currency: 'USD',
                                    passengerCount: b.passengers.length,
                                    tourId: b.tour.id,
                                    tourSlug: b.tour.slug,
                                    tourNameEn: tourNameEn,
                                    invoiceNumber: ((_a = b.invoice) === null || _a === void 0 ? void 0 : _a.invoiceNumber) || null,
                                    createdAt: b.createdAt,
                                    updatedAt: b.updatedAt,
                                    passengers: b.passengers.map(function (p) { return ({
                                        id: p.id,
                                        fullName: p.fullName,
                                        passengerType: p.passengerType,
                                        passportNumber: p.passportNumber || null,
                                        passportExpiry: p.passportExpiry || null,
                                        dateOfBirth: p.dateOfBirth || null,
                                        nationality: p.nationality || null,
                                    }); }),
                                    billingInfo: b.billingInfo ? {
                                        fullName: b.billingInfo.fullName,
                                        email: b.billingInfo.email,
                                        phone: b.billingInfo.phone || null,
                                        address: b.billingInfo.address || null,
                                        city: b.billingInfo.city || null,
                                        country: b.billingInfo.country || null,
                                    } : null,
                                    invoice: b.invoice ? {
                                        id: b.invoice.id,
                                        invoiceNumber: b.invoice.invoiceNumber,
                                        createdAt: b.invoice.issuedAt,
                                    } : null,
                                    payments: b.payments,
                                    activityLogs: b.activityLogs,
                                    notes: b.notesList,
                                    attachments: b.attachments,
                                }];
                    }
                });
            });
        };
        AdminService_1.prototype.updateBooking = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.booking.update({
                                    where: { referenceCode: referenceCode },
                                    data: __assign(__assign(__assign(__assign(__assign({}, (dto.transportChoice !== undefined && { transportChoice: dto.transportChoice })), (dto.notes !== undefined && { notes: dto.notes })), (dto.cancellationReason !== undefined && { cancellationReason: dto.cancellationReason })), (dto.arrivalDate && { arrivalDate: new Date(dto.arrivalDate) })), (dto.departureDate && { departureDate: new Date(dto.departureDate) }))
                                })];
                        case 2:
                            updated = _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'BOOKING_UPDATED',
                                        details: dto
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        AdminService_1.prototype.updateBookingStatus = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, validTransitions, allowed, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            if (booking.status === dto.status) {
                                throw new common_1.BadRequestException("Booking is already in status ".concat(dto.status));
                            }
                            validTransitions = {
                                PENDING: ['CONFIRMED', 'CANCELLED', 'ARCHIVED'],
                                CONFIRMED: ['PAID', 'CANCELLED', 'ARCHIVED'],
                                PAID: ['COMPLETED', 'REFUNDED', 'ARCHIVED'],
                                COMPLETED: ['ARCHIVED'],
                                CANCELLED: ['ARCHIVED'],
                                REFUNDED: ['ARCHIVED'],
                                ARCHIVED: [],
                            };
                            allowed = validTransitions[booking.status] || [];
                            if (!allowed.includes(dto.status)) {
                                throw new common_1.BadRequestException("Cannot transition booking status from ".concat(booking.status, " to ").concat(dto.status));
                            }
                            return [4 /*yield*/, this.prisma.booking.update({
                                    where: { referenceCode: referenceCode },
                                    data: __assign({ status: dto.status }, (dto.reason && { cancellationReason: dto.reason }))
                                })];
                        case 2:
                            updated = _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'STATUS_CHANGED',
                                        details: { oldStatus: booking.status, newStatus: dto.status, reason: dto.reason }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        AdminService_1.prototype.addPayment = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, payment;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _b.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.payment.create({
                                    data: {
                                        bookingId: booking.id,
                                        amount: dto.amount,
                                        currency: dto.currency,
                                        method: dto.method,
                                        transactionId: dto.transactionId,
                                        isRefund: (_a = dto.isRefund) !== null && _a !== void 0 ? _a : false,
                                    }
                                })];
                        case 2:
                            payment = _b.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: dto.isRefund ? 'REFUND_ADDED' : 'PAYMENT_ADDED',
                                        details: { amount: dto.amount, currency: dto.currency, method: dto.method }
                                    }
                                })];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, payment];
                    }
                });
            });
        };
        AdminService_1.prototype.addBookingNote = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, note;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.bookingNote.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        content: dto.content,
                                    }
                                })];
                        case 2:
                            note = _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'NOTE_ADDED',
                                        details: { noteId: note.id }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, note];
                    }
                });
            });
        };
        AdminService_1.prototype.addBookingAttachment = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, attachment;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.bookingAttachment.create({
                                    data: {
                                        bookingId: booking.id,
                                        mediaAssetId: dto.mediaAssetId,
                                        uploadedBy: adminUserId,
                                    }
                                })];
                        case 2:
                            attachment = _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'ATTACHMENT_ADDED',
                                        details: { mediaAssetId: dto.mediaAssetId }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, attachment];
                    }
                });
            });
        };
        AdminService_1.prototype.upsertPassengers = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.passenger.deleteMany({ where: { bookingId: booking.id } })];
                                            case 1:
                                                _a.sent();
                                                return [4 /*yield*/, tx.passenger.createMany({
                                                        data: dto.passengers.map(function (p) { return ({
                                                            bookingId: booking.id,
                                                            passengerType: p.passengerType,
                                                            fullName: p.fullName,
                                                            passportNumber: p.passportNumber || null,
                                                            passportExpiry: p.passportExpiry ? new Date(p.passportExpiry) : null,
                                                            dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
                                                            nationality: p.nationality || null,
                                                        }); })
                                                    })];
                                            case 2:
                                                _a.sent();
                                                return [4 /*yield*/, tx.bookingActivityLog.create({
                                                        data: {
                                                            bookingId: booking.id,
                                                            userId: adminUserId,
                                                            action: 'PASSENGERS_UPDATED',
                                                            details: { count: dto.passengers.length }
                                                        }
                                                    })];
                                            case 3:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        AdminService_1.prototype.assignBooking = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.booking.update({
                                    where: { referenceCode: referenceCode },
                                    data: { assigneeId: dto.assigneeId }
                                })];
                        case 2:
                            updated = _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'ASSIGNEE_CHANGED',
                                        details: { oldAssigneeId: booking.assigneeId, newAssigneeId: dto.assigneeId }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, updated];
                    }
                });
            });
        };
        AdminService_1.prototype.bulkUpdateBookings = function (dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, count;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = {};
                            if (dto.status)
                                data.status = dto.status;
                            if (dto.assigneeId !== undefined)
                                data.assigneeId = dto.assigneeId;
                            if (dto.priority)
                                data.priority = dto.priority;
                            if (Object.keys(data).length === 0)
                                return [2 /*return*/, { count: 0 }];
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var result, bookings;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.booking.updateMany({
                                                    where: { referenceCode: { in: dto.referenceCodes } },
                                                    data: data
                                                })];
                                            case 1:
                                                result = _a.sent();
                                                return [4 /*yield*/, tx.booking.findMany({
                                                        where: { referenceCode: { in: dto.referenceCodes } },
                                                        select: { id: true }
                                                    })];
                                            case 2:
                                                bookings = _a.sent();
                                                if (!(bookings.length > 0)) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.bookingActivityLog.createMany({
                                                        data: bookings.map(function (b) { return ({
                                                            bookingId: b.id,
                                                            userId: adminUserId,
                                                            action: 'BULK_UPDATE',
                                                            details: data
                                                        }); })
                                                    })];
                                            case 3:
                                                _a.sent();
                                                _a.label = 4;
                                            case 4: return [2 /*return*/, result.count];
                                        }
                                    });
                                }); })];
                        case 1:
                            count = _a.sent();
                            return [2 /*return*/, { count: count }];
                    }
                });
            });
        };
        AdminService_1.prototype.softDeleteBooking = function (referenceCode, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.booking.update({
                                    where: { referenceCode: referenceCode },
                                    data: { deletedAt: new Date() }
                                })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'BOOKING_DELETED',
                                        details: { softDelete: true }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        AdminService_1.prototype.restoreBooking = function (referenceCode, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var booking;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.booking.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            booking = _a.sent();
                            if (!booking)
                                throw new common_1.NotFoundException('Booking not found');
                            return [4 /*yield*/, this.prisma.booking.update({
                                    where: { referenceCode: referenceCode },
                                    data: { deletedAt: null }
                                })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.bookingActivityLog.create({
                                    data: {
                                        bookingId: booking.id,
                                        userId: adminUserId,
                                        action: 'BOOKING_RESTORED',
                                        details: { restore: true }
                                    }
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        AdminService_1.prototype.exportBookingsCsv = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var status, tourId, dateFrom, dateTo, search, paymentStatus, _a, sortBy, _b, sortOrder, where, headers, rows, skip, batchSize, hasMore, batch, _i, batch_1, b;
                var _c;
                var _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            status = query.status, tourId = query.tourId, dateFrom = query.dateFrom, dateTo = query.dateTo, search = query.search, paymentStatus = query.paymentStatus, _a = query.sortBy, sortBy = _a === void 0 ? 'createdAt' : _a, _b = query.sortOrder, sortOrder = _b === void 0 ? 'desc' : _b;
                            where = { deletedAt: null };
                            if (query.includeDeleted === 'true' || query.includeDeleted === true) {
                                delete where.deletedAt;
                            }
                            if (status)
                                where.status = status;
                            if (paymentStatus && !status)
                                where.status = paymentStatus;
                            if (tourId)
                                where.tourId = tourId;
                            if (dateFrom || dateTo) {
                                where.createdAt = {};
                                if (dateFrom)
                                    where.createdAt.gte = new Date(dateFrom);
                                if (dateTo)
                                    where.createdAt.lte = new Date(dateTo);
                            }
                            if (search) {
                                where.OR = [
                                    { referenceCode: { contains: search, mode: 'insensitive' } },
                                    { billingInfo: { fullName: { contains: search, mode: 'insensitive' } } },
                                    { billingInfo: { email: { contains: search, mode: 'insensitive' } } },
                                ];
                            }
                            headers = ['Reference', 'Date', 'Status', 'Tour', 'Customer Name', 'Customer Email', 'Amount (USD)', 'Invoice'];
                            rows = [];
                            skip = 0;
                            batchSize = 1000;
                            hasMore = true;
                            _g.label = 1;
                        case 1:
                            if (!hasMore) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.booking.findMany({
                                    where: where,
                                    skip: skip,
                                    take: batchSize,
                                    orderBy: (_c = {}, _c[sortBy] = sortOrder, _c),
                                    include: {
                                        tour: { select: { slug: true } },
                                        billingInfo: { select: { fullName: true, email: true } },
                                        invoice: { select: { invoiceNumber: true } }
                                    }
                                })];
                        case 2:
                            batch = _g.sent();
                            for (_i = 0, batch_1 = batch; _i < batch_1.length; _i++) {
                                b = batch_1[_i];
                                rows.push([
                                    b.referenceCode,
                                    b.createdAt.toISOString().split('T')[0],
                                    b.status,
                                    b.tour.slug,
                                    ((_d = b.billingInfo) === null || _d === void 0 ? void 0 : _d.fullName) || 'N/A',
                                    ((_e = b.billingInfo) === null || _e === void 0 ? void 0 : _e.email) || 'N/A',
                                    b.totalAmountUsd.toString(),
                                    ((_f = b.invoice) === null || _f === void 0 ? void 0 : _f.invoiceNumber) || 'N/A'
                                ]);
                            }
                            skip += batchSize;
                            if (batch.length < batchSize) {
                                hasMore = false;
                            }
                            return [3 /*break*/, 1];
                        case 3:
                            this.logger.log("exportBookingsCsv invoked by admin ".concat(adminUserId, ". Exported ").concat(rows.length, " records via batching."));
                            return [2 /*return*/, __spreadArray([headers.join(',')], rows.map(function (r) { return r.map(function (c) { return "\"".concat(c, "\""); }).join(','); }), true).join('\n')];
                    }
                });
            });
        };
        AdminService_1.prototype.listInquiries = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, status, email, dateFrom, dateTo, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, status = query.status, email = query.email, dateFrom = query.dateFrom, dateTo = query.dateTo, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("listInquiries invoked by admin ".concat(adminUserId, " with filters: ").concat(JSON.stringify(query)));
                            where = {};
                            if (status)
                                where.status = status;
                            if (email)
                                where.email = { contains: email, mode: 'insensitive' };
                            if (dateFrom || dateTo) {
                                where.createdAt = {};
                                if (dateFrom)
                                    where.createdAt.gte = new Date(dateFrom);
                                if (dateTo)
                                    where.createdAt.lte = new Date(dateTo);
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.tailorMadeInquiry.count({ where: where }),
                                    this.prisma.tailorMadeInquiry.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                    })
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (r) {
                                var parts = r.fullName.split(' ');
                                var firstName = parts[0];
                                var lastName = parts.slice(1).join(' ') || '';
                                return {
                                    id: r.id,
                                    referenceCode: r.referenceCode,
                                    status: r.status,
                                    firstName: firstName,
                                    lastName: lastName,
                                    email: r.email,
                                    phone: r.phone || null,
                                    numberOfTravelers: r.adults + r.children,
                                    createdAt: r.createdAt,
                                };
                            });
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) }];
                    }
                });
            });
        };
        AdminService_1.prototype.getInquiryByReferenceCode = function (referenceCode, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var r, parts, firstName, lastName, budget;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("getInquiryByReferenceCode invoked by admin ".concat(adminUserId, " for Ref: ").concat(referenceCode));
                            return [4 /*yield*/, this.prisma.tailorMadeInquiry.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            r = _a.sent();
                            if (!r)
                                throw new common_1.NotFoundException("Inquiry with reference ".concat(referenceCode, " not found"));
                            parts = r.fullName.split(' ');
                            firstName = parts[0];
                            lastName = parts.slice(1).join(' ') || '';
                            budget = null;
                            if (r.budgetAmount) {
                                budget = "".concat(r.budgetCurrency || 'USD', " ").concat(r.budgetAmount.toString());
                            }
                            return [2 /*return*/, {
                                    id: r.id,
                                    referenceCode: r.referenceCode,
                                    status: r.status,
                                    firstName: firstName,
                                    lastName: lastName,
                                    email: r.email,
                                    phone: r.phone || null,
                                    numberOfTravelers: r.adults + r.children,
                                    createdAt: r.createdAt,
                                    departureDate: r.startDate || null,
                                    returnDate: r.endDate || null,
                                    destinations: r.destinations,
                                    message: r.notes || null,
                                    budget: budget,
                                    locale: r.preferredLanguage,
                                    ipAddress: null,
                                    updatedAt: r.updatedAt,
                                }];
                    }
                });
            });
        };
        AdminService_1.prototype.updateInquiryStatus = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var inquiry, validTransitions, allowed, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.tailorMadeInquiry.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            inquiry = _a.sent();
                            if (!inquiry)
                                throw new common_1.NotFoundException("Inquiry with reference ".concat(referenceCode, " not found"));
                            validTransitions = {
                                NEWLY_RECEIVED: ['IN_PROGRESS', 'CLOSED'],
                                IN_PROGRESS: ['CLOSED'],
                                CLOSED: [],
                            };
                            allowed = validTransitions[inquiry.status] || [];
                            if (!allowed.includes(dto.status)) {
                                this.logger.warn("Admin ".concat(adminUserId, " attempted invalid inquiry status transition for ").concat(referenceCode, ": ").concat(inquiry.status, " -> ").concat(dto.status));
                                throw new common_1.BadRequestException("Invalid status transition from ".concat(inquiry.status, " to ").concat(dto.status));
                            }
                            return [4 /*yield*/, this.prisma.tailorMadeInquiry.update({
                                    where: { referenceCode: referenceCode },
                                    data: { status: dto.status },
                                })];
                        case 2:
                            updated = _a.sent();
                            this.logger.log("Admin ".concat(adminUserId, " updated inquiry ").concat(referenceCode, " status: ").concat(inquiry.status, " -> ").concat(dto.status));
                            return [2 /*return*/, this.getInquiryByReferenceCode(referenceCode, adminUserId)];
                    }
                });
            });
        };
        AdminService_1.prototype.listContactSubmissions = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, status, email, dateFrom, dateTo, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, status = query.status, email = query.email, dateFrom = query.dateFrom, dateTo = query.dateTo, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("listContactSubmissions invoked by admin ".concat(adminUserId, " with filters: ").concat(JSON.stringify(query)));
                            where = {};
                            if (status)
                                where.status = status;
                            if (email)
                                where.email = { contains: email, mode: 'insensitive' };
                            if (dateFrom || dateTo) {
                                where.createdAt = {};
                                if (dateFrom)
                                    where.createdAt.gte = new Date(dateFrom);
                                if (dateTo)
                                    where.createdAt.lte = new Date(dateTo);
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.contactSubmission.count({ where: where }),
                                    this.prisma.contactSubmission.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                    })
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (r) { return ({
                                id: r.id,
                                referenceCode: r.referenceCode,
                                status: r.status,
                                firstName: r.firstName,
                                lastName: r.lastName,
                                email: r.email,
                                phone: r.phone || null,
                                subject: r.subject,
                                createdAt: r.createdAt,
                            }); });
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) }];
                    }
                });
            });
        };
        AdminService_1.prototype.getContactSubmissionByReferenceCode = function (referenceCode, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var r;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("getContactSubmissionByReferenceCode invoked by admin ".concat(adminUserId, " for Ref: ").concat(referenceCode));
                            return [4 /*yield*/, this.prisma.contactSubmission.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            r = _a.sent();
                            if (!r)
                                throw new common_1.NotFoundException("Contact submission with reference ".concat(referenceCode, " not found"));
                            return [2 /*return*/, {
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
                                }];
                    }
                });
            });
        };
        AdminService_1.prototype.updateContactSubmissionStatus = function (referenceCode, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var contact, validTransitions, allowed, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.contactSubmission.findUnique({ where: { referenceCode: referenceCode } })];
                        case 1:
                            contact = _a.sent();
                            if (!contact)
                                throw new common_1.NotFoundException("Contact submission with reference ".concat(referenceCode, " not found"));
                            validTransitions = {
                                NEW: ['READ', 'ARCHIVED'],
                                READ: ['ARCHIVED'],
                                ARCHIVED: [],
                            };
                            allowed = validTransitions[contact.status] || [];
                            if (!allowed.includes(dto.status)) {
                                this.logger.warn("Admin ".concat(adminUserId, " attempted invalid contact status transition for ").concat(referenceCode, ": ").concat(contact.status, " -> ").concat(dto.status));
                                throw new common_1.BadRequestException("Invalid status transition from ".concat(contact.status, " to ").concat(dto.status));
                            }
                            return [4 /*yield*/, this.prisma.contactSubmission.update({
                                    where: { referenceCode: referenceCode },
                                    data: { status: dto.status },
                                })];
                        case 2:
                            updated = _a.sent();
                            this.logger.log("Admin ".concat(adminUserId, " updated contact submission ").concat(referenceCode, " status: ").concat(contact.status, " -> ").concat(dto.status));
                            return [2 /*return*/, this.getContactSubmissionByReferenceCode(referenceCode, adminUserId)];
                    }
                });
            });
        };
        AdminService_1.prototype.listNotificationLogs = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, status, originEvent, dateFrom, dateTo, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, status = query.status, originEvent = query.originEvent, dateFrom = query.dateFrom, dateTo = query.dateTo, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("listNotificationLogs invoked by admin ".concat(adminUserId, " with filters: ").concat(JSON.stringify(query)));
                            where = {};
                            if (status)
                                where.status = status;
                            if (originEvent)
                                where.originEntityType = originEvent;
                            if (dateFrom || dateTo) {
                                where.createdAt = {};
                                if (dateFrom)
                                    where.createdAt.gte = new Date(dateFrom);
                                if (dateTo)
                                    where.createdAt.lte = new Date(dateTo);
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.notificationDeliveryLog.count({ where: where }),
                                    this.prisma.notificationDeliveryLog.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                    })
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (r) { return ({
                                id: r.id,
                                channel: 'EMAIL',
                                recipient: r.recipientEmail,
                                subject: r.notificationType,
                                status: r.status,
                                attempts: r.attempts,
                                originEvent: r.originEntityType,
                                originReferenceCode: r.originReferenceCode,
                                failureReason: r.failureReason || null,
                                createdAt: r.createdAt,
                                updatedAt: r.updatedAt,
                            }); });
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) }];
                    }
                });
            });
        };
        AdminService_1.prototype.getDashboardMetrics = function (adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var cacheKey, cachedMetrics, start, now, firstDayOfMonth, _a, totalBookings, bookingsThisMonth, totalInquiries, openInquiries, totalContactSubmissions, unreadContactSubmissions, totalNotificationsSent, totalNotificationsFailed, recentFailedNotificationsData, recentFailedNotifications, ms, metrics;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            cacheKey = 'admin_dashboard_metrics';
                            return [4 /*yield*/, this.cacheManager.get(cacheKey)];
                        case 1:
                            cachedMetrics = _b.sent();
                            if (cachedMetrics) {
                                this.logger.debug("Returning cached dashboard metrics for admin ".concat(adminUserId));
                                return [2 /*return*/, cachedMetrics];
                            }
                            start = Date.now();
                            now = new Date();
                            firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.booking.count(),
                                    this.prisma.booking.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
                                    this.prisma.tailorMadeInquiry.count(),
                                    this.prisma.tailorMadeInquiry.count({ where: { status: { in: ['NEWLY_RECEIVED', 'IN_PROGRESS'] } } }),
                                    this.prisma.contactSubmission.count(),
                                    this.prisma.contactSubmission.count({ where: { status: 'NEW' } }),
                                    this.prisma.notificationDeliveryLog.count({ where: { status: 'SENT' } }),
                                    this.prisma.notificationDeliveryLog.count({ where: { status: 'FAILED' } }),
                                    this.prisma.notificationDeliveryLog.findMany({
                                        where: { status: 'FAILED' },
                                        orderBy: { createdAt: 'desc' },
                                        take: 5,
                                    })
                                ])];
                        case 2:
                            _a = _b.sent(), totalBookings = _a[0], bookingsThisMonth = _a[1], totalInquiries = _a[2], openInquiries = _a[3], totalContactSubmissions = _a[4], unreadContactSubmissions = _a[5], totalNotificationsSent = _a[6], totalNotificationsFailed = _a[7], recentFailedNotificationsData = _a[8];
                            recentFailedNotifications = recentFailedNotificationsData.map(function (r) { return ({
                                id: r.id,
                                recipient: r.recipientEmail,
                                subject: r.notificationType,
                                originEvent: r.originEntityType,
                                originReferenceCode: r.originReferenceCode,
                                failureReason: r.failureReason || null,
                                createdAt: r.createdAt,
                            }); });
                            ms = Date.now() - start;
                            this.logger.log("getDashboardMetrics invoked by admin ".concat(adminUserId, ". Computed in ").concat(ms, "ms."));
                            metrics = {
                                totalBookings: totalBookings,
                                bookingsThisMonth: bookingsThisMonth,
                                totalInquiries: totalInquiries,
                                openInquiries: openInquiries,
                                totalContactSubmissions: totalContactSubmissions,
                                unreadContactSubmissions: unreadContactSubmissions,
                                totalNotificationsSent: totalNotificationsSent,
                                totalNotificationsFailed: totalNotificationsFailed,
                                recentFailedNotifications: recentFailedNotifications,
                            };
                            // Cache for 5 minutes (300,000 ms)
                            return [4 /*yield*/, this.cacheManager.set(cacheKey, metrics, 300000)];
                        case 3:
                            // Cache for 5 minutes (300,000 ms)
                            _b.sent();
                            return [2 /*return*/, metrics];
                    }
                });
            });
        };
        AdminService_1.prototype.listTours = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, search, country, city, category, status, isFeatured, tag, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, search = query.search, country = query.country, city = query.city, category = query.category, status = query.status, isFeatured = query.isFeatured, tag = query.tag, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("listTours invoked by admin ".concat(adminUserId, " with filters: ").concat(JSON.stringify(query)));
                            where = { deletedAt: null };
                            if (country)
                                where.country = { equals: country, mode: 'insensitive' };
                            if (city)
                                where.city = { equals: city, mode: 'insensitive' };
                            if (category)
                                where.category = { equals: category, mode: 'insensitive' };
                            if (status)
                                where.status = status;
                            if (isFeatured !== undefined)
                                where.isFeatured = isFeatured === 'true';
                            if (tag)
                                where.tags = { has: tag };
                            if (search) {
                                where.OR = [
                                    { slug: { contains: search, mode: 'insensitive' } },
                                    { category: { contains: search, mode: 'insensitive' } },
                                ];
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.tour.count({ where: where }),
                                    this.prisma.tour.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                        include: {
                                            _count: { select: { bookings: true, reviews: true } },
                                            images: { where: { isHero: true }, take: 1, select: { imageUrl: true } }
                                        }
                                    })
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (t) {
                                var _a;
                                return ({
                                    id: t.id,
                                    slug: t.slug,
                                    titleJsonb: t.titleJsonb,
                                    category: t.category,
                                    basePriceUsd: t.basePriceUsd.toString(),
                                    currency: t.currency,
                                    isActive: t.isActive,
                                    status: t.status,
                                    isFeatured: t.isFeatured,
                                    country: t.country,
                                    city: t.city,
                                    capacity: t.capacity,
                                    remainingSeats: t.remainingSeats,
                                    bookingCount: t._count.bookings,
                                    reviewCount: t._count.reviews,
                                    heroImage: ((_a = t.images[0]) === null || _a === void 0 ? void 0 : _a.imageUrl) || null,
                                    createdAt: t.createdAt,
                                });
                            });
                            return [2 /*return*/, { data: data, total: total, page: page, limit: limit, totalPages: Math.ceil(total / limit) }];
                    }
                });
            });
        };
        AdminService_1.prototype.getTourStats = function (adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, totalTours, publishedTours, draftTours, featuredTours, allTours, totalCapacity, totalRemaining, seatsSold;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            this.logger.log("getTourStats invoked by admin ".concat(adminUserId));
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.tour.count({ where: { deletedAt: null } }),
                                    this.prisma.tour.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
                                    this.prisma.tour.count({ where: { deletedAt: null, status: 'DRAFT' } }),
                                    this.prisma.tour.count({ where: { deletedAt: null, isFeatured: true } }),
                                    this.prisma.tour.findMany({
                                        where: { deletedAt: null },
                                        select: { capacity: true, remainingSeats: true }
                                    })
                                ])];
                        case 1:
                            _a = _b.sent(), totalTours = _a[0], publishedTours = _a[1], draftTours = _a[2], featuredTours = _a[3], allTours = _a[4];
                            totalCapacity = allTours.reduce(function (sum, t) { return sum + (t.capacity || 0); }, 0);
                            totalRemaining = allTours.reduce(function (sum, t) { return sum + (t.remainingSeats || 0); }, 0);
                            seatsSold = totalCapacity - totalRemaining;
                            return [2 /*return*/, {
                                    totalTours: totalTours,
                                    publishedTours: publishedTours,
                                    draftTours: draftTours,
                                    featuredTours: featuredTours,
                                    totalCapacity: totalCapacity,
                                    totalRemainingSeats: totalRemaining,
                                    seatsSold: seatsSold,
                                    occupancyRate: totalCapacity > 0 ? ((seatsSold / totalCapacity) * 100).toFixed(1) : '0.0'
                                }];
                    }
                });
            });
        };
        AdminService_1.prototype.exportToursCsv = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var search, country, city, category, status, isFeatured, tag, _a, sortBy, _b, sortOrder, where, records, headers, rows;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            search = query.search, country = query.country, city = query.city, category = query.category, status = query.status, isFeatured = query.isFeatured, tag = query.tag, _a = query.sortBy, sortBy = _a === void 0 ? 'createdAt' : _a, _b = query.sortOrder, sortOrder = _b === void 0 ? 'desc' : _b;
                            where = { deletedAt: null };
                            if (country)
                                where.country = { equals: country, mode: 'insensitive' };
                            if (city)
                                where.city = { equals: city, mode: 'insensitive' };
                            if (category)
                                where.category = { equals: category, mode: 'insensitive' };
                            if (status)
                                where.status = status;
                            if (isFeatured !== undefined)
                                where.isFeatured = isFeatured === 'true';
                            if (tag)
                                where.tags = { has: tag };
                            if (search) {
                                where.OR = [
                                    { slug: { contains: search, mode: 'insensitive' } },
                                    { category: { contains: search, mode: 'insensitive' } },
                                ];
                            }
                            return [4 /*yield*/, this.prisma.tour.findMany({
                                    where: where,
                                    orderBy: (_c = {}, _c[sortBy] = sortOrder, _c),
                                    include: { _count: { select: { bookings: true } } }
                                })];
                        case 1:
                            records = _d.sent();
                            headers = ['Slug', 'Title (EN)', 'Category', 'Country', 'City', 'Price (USD)', 'Status', 'Featured', 'Capacity', 'Remaining Seats', 'Bookings'];
                            rows = records.map(function (t) {
                                var titleObj = t.titleJsonb || {};
                                return [
                                    t.slug,
                                    titleObj['en'] || t.slug,
                                    t.category || 'N/A',
                                    t.country || 'N/A',
                                    t.city || 'N/A',
                                    t.basePriceUsd.toString(),
                                    t.status,
                                    t.isFeatured ? 'Yes' : 'No',
                                    t.capacity.toString(),
                                    t.remainingSeats.toString(),
                                    t._count.bookings.toString()
                                ];
                            });
                            this.logger.log("exportToursCsv invoked by admin ".concat(adminUserId, ". Exported ").concat(records.length, " tours."));
                            return [2 /*return*/, __spreadArray([headers.join(',')], rows.map(function (r) { return r.map(function (c) { return "\"".concat(c, "\""); }).join(','); }), true).join('\n')];
                    }
                });
            });
        };
        AdminService_1.prototype.getTourBySlug = function (slug, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var tour;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("getTourBySlug invoked by admin ".concat(adminUserId, " for slug: ").concat(slug));
                            return [4 /*yield*/, this.prisma.tour.findUnique({
                                    where: { slug: slug },
                                    include: {
                                        itineraries: { orderBy: { sortOrder: 'asc' } },
                                        images: { orderBy: { sortOrder: 'asc' } },
                                        reviews: { orderBy: { createdAt: 'desc' } },
                                        activityLogs: { orderBy: { createdAt: 'desc' } },
                                        bookings: {
                                            orderBy: { createdAt: 'desc' },
                                            include: { billingInfo: { select: { fullName: true, email: true } } }
                                        }
                                    }
                                })];
                        case 1:
                            tour = _a.sent();
                            if (!tour)
                                throw new common_1.NotFoundException("Tour with slug ".concat(slug, " not found"));
                            return [2 /*return*/, __assign(__assign({}, tour), { basePriceUsd: tour.basePriceUsd.toString(), bookings: tour.bookings.map(function (b) { return (__assign(__assign({}, b), { totalAmountUsd: b.totalAmountUsd.toString() })); }) })];
                    }
                });
            });
        };
        AdminService_1.prototype.createTour = function (dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, itineraries, images, tourData, tour;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("createTour invoked by admin ".concat(adminUserId, " for slug: ").concat(dto.slug));
                            return [4 /*yield*/, this.prisma.tour.findUnique({ where: { slug: dto.slug } })];
                        case 1:
                            existing = _a.sent();
                            if (existing)
                                throw new common_1.BadRequestException("Tour with slug ".concat(dto.slug, " already exists"));
                            itineraries = dto.itineraries, images = dto.images, tourData = __rest(dto, ["itineraries", "images"]);
                            return [4 /*yield*/, this.prisma.tour.create({
                                    data: __assign(__assign({}, tourData), { itineraries: itineraries ? {
                                            create: itineraries.map(function (it) { return ({
                                                dayLabel: it.dayLabel,
                                                descriptionJsonb: it.descriptionJsonb,
                                                mealsJsonb: it.mealsJsonb,
                                                activitiesJsonb: it.activitiesJsonb,
                                                hotelsJsonb: it.hotelsJsonb,
                                                transportationJsonb: it.transportationJsonb,
                                                notesJsonb: it.notesJsonb,
                                                sortOrder: it.sortOrder
                                            }); })
                                        } : undefined, images: images ? {
                                            create: images.map(function (img) {
                                                var _a, _b;
                                                return ({
                                                    imageUrl: img.imageUrl,
                                                    isHero: (_a = img.isHero) !== null && _a !== void 0 ? _a : false,
                                                    isVideo: (_b = img.isVideo) !== null && _b !== void 0 ? _b : false,
                                                    videoUrl: img.videoUrl,
                                                    altText: img.altText,
                                                    sortOrder: img.sortOrder
                                                });
                                            })
                                        } : undefined, activityLogs: {
                                            create: [{
                                                    userId: adminUserId,
                                                    action: 'TOUR_CREATED',
                                                    details: { slug: dto.slug }
                                                }]
                                        } })
                                })];
                        case 2:
                            tour = _a.sent();
                            return [2 /*return*/, { success: true, slug: tour.slug }];
                    }
                });
            });
        };
        AdminService_1.prototype.updateTour = function (slug, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var tour, itineraries, images, tourData, updated, langs, _i, langs_1, l;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("updateTour invoked by admin ".concat(adminUserId, " for slug: ").concat(slug));
                            return [4 /*yield*/, this.prisma.tour.findUnique({ where: { slug: slug } })];
                        case 1:
                            tour = _a.sent();
                            if (!tour)
                                throw new common_1.NotFoundException("Tour with slug ".concat(slug, " not found"));
                            itineraries = dto.itineraries, images = dto.images, tourData = __rest(dto, ["itineraries", "images"]);
                            if (!itineraries) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.tourItinerary.deleteMany({ where: { tourId: tour.id } })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.tourItinerary.createMany({
                                    data: itineraries.map(function (it) {
                                        var _a, _b, _c, _d, _e;
                                        return ({
                                            tourId: tour.id,
                                            dayLabel: it.dayLabel,
                                            descriptionJsonb: it.descriptionJsonb,
                                            mealsJsonb: (_a = it.mealsJsonb) !== null && _a !== void 0 ? _a : undefined,
                                            activitiesJsonb: (_b = it.activitiesJsonb) !== null && _b !== void 0 ? _b : undefined,
                                            hotelsJsonb: (_c = it.hotelsJsonb) !== null && _c !== void 0 ? _c : undefined,
                                            transportationJsonb: (_d = it.transportationJsonb) !== null && _d !== void 0 ? _d : undefined,
                                            notesJsonb: (_e = it.notesJsonb) !== null && _e !== void 0 ? _e : undefined,
                                            sortOrder: it.sortOrder
                                        });
                                    })
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            if (!images) return [3 /*break*/, 7];
                            return [4 /*yield*/, this.prisma.tourImage.deleteMany({ where: { tourId: tour.id } })];
                        case 5:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.tourImage.createMany({
                                    data: images.map(function (img) {
                                        var _a, _b, _c, _d;
                                        return ({
                                            tourId: tour.id,
                                            imageUrl: img.imageUrl,
                                            isHero: (_a = img.isHero) !== null && _a !== void 0 ? _a : false,
                                            isVideo: (_b = img.isVideo) !== null && _b !== void 0 ? _b : false,
                                            videoUrl: (_c = img.videoUrl) !== null && _c !== void 0 ? _c : undefined,
                                            altText: (_d = img.altText) !== null && _d !== void 0 ? _d : undefined,
                                            sortOrder: img.sortOrder
                                        });
                                    })
                                })];
                        case 6:
                            _a.sent();
                            _a.label = 7;
                        case 7: return [4 /*yield*/, this.prisma.tour.update({
                                where: { slug: slug },
                                data: __assign(__assign({}, tourData), { activityLogs: {
                                        create: [{
                                                userId: adminUserId,
                                                action: 'TOUR_UPDATED',
                                                details: tourData
                                            }]
                                    } })
                            })];
                        case 8:
                            updated = _a.sent();
                            langs = ['en', 'es', 'pt', 'it', 'ar'];
                            _i = 0, langs_1 = langs;
                            _a.label = 9;
                        case 9:
                            if (!(_i < langs_1.length)) return [3 /*break*/, 12];
                            l = langs_1[_i];
                            return [4 /*yield*/, this.cacheManager.del("tour:".concat(slug, ":").concat(l))];
                        case 10:
                            _a.sent();
                            _a.label = 11;
                        case 11:
                            _i++;
                            return [3 /*break*/, 9];
                        case 12: return [2 /*return*/, { success: true, slug: updated.slug }];
                    }
                });
            });
        };
        AdminService_1.prototype.bulkUpdateTours = function (dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, result, tours, langs, _i, tours_1, t, _a, langs_2, l;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            this.logger.log("bulkUpdateTours invoked by admin ".concat(adminUserId));
                            data = {};
                            if (dto.status)
                                data.status = dto.status;
                            if (dto.category)
                                data.category = dto.category;
                            if (dto.country)
                                data.country = dto.country;
                            if (dto.isActive !== undefined)
                                data.isActive = dto.isActive;
                            if (Object.keys(data).length === 0)
                                return [2 /*return*/, { count: 0 }];
                            return [4 /*yield*/, this.prisma.tour.updateMany({
                                    where: { slug: { in: dto.slugs } },
                                    data: data
                                })];
                        case 1:
                            result = _b.sent();
                            return [4 /*yield*/, this.prisma.tour.findMany({
                                    where: { slug: { in: dto.slugs } },
                                    select: { id: true, slug: true }
                                })];
                        case 2:
                            tours = _b.sent();
                            if (!(tours.length > 0)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.tourActivityLog.createMany({
                                    data: tours.map(function (t) { return ({
                                        tourId: t.id,
                                        userId: adminUserId,
                                        action: 'BULK_UPDATE',
                                        details: data
                                    }); })
                                })];
                        case 3:
                            _b.sent();
                            _b.label = 4;
                        case 4:
                            langs = ['en', 'es', 'pt', 'it', 'ar'];
                            _i = 0, tours_1 = tours;
                            _b.label = 5;
                        case 5:
                            if (!(_i < tours_1.length)) return [3 /*break*/, 10];
                            t = tours_1[_i];
                            _a = 0, langs_2 = langs;
                            _b.label = 6;
                        case 6:
                            if (!(_a < langs_2.length)) return [3 /*break*/, 9];
                            l = langs_2[_a];
                            return [4 /*yield*/, this.cacheManager.del("tour:".concat(t.slug, ":").concat(l))];
                        case 7:
                            _b.sent();
                            _b.label = 8;
                        case 8:
                            _a++;
                            return [3 /*break*/, 6];
                        case 9:
                            _i++;
                            return [3 /*break*/, 5];
                        case 10: return [2 /*return*/, { count: result.count }];
                    }
                });
            });
        };
        AdminService_1.prototype.softDeleteTour = function (slug, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var tour, langs, _i, langs_3, l;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("softDeleteTour invoked by admin ".concat(adminUserId, " for slug: ").concat(slug));
                            return [4 /*yield*/, this.prisma.tour.findUnique({ where: { slug: slug } })];
                        case 1:
                            tour = _a.sent();
                            if (!tour)
                                throw new common_1.NotFoundException("Tour with slug ".concat(slug, " not found"));
                            return [4 /*yield*/, this.prisma.tour.update({
                                    where: { slug: slug },
                                    data: {
                                        deletedAt: new Date(),
                                        status: 'ARCHIVED',
                                        activityLogs: {
                                            create: [{
                                                    userId: adminUserId,
                                                    action: 'TOUR_SOFT_DELETED',
                                                    details: { softDelete: true }
                                                }]
                                        }
                                    }
                                })];
                        case 2:
                            _a.sent();
                            langs = ['en', 'es', 'pt', 'it', 'ar'];
                            _i = 0, langs_3 = langs;
                            _a.label = 3;
                        case 3:
                            if (!(_i < langs_3.length)) return [3 /*break*/, 6];
                            l = langs_3[_i];
                            return [4 /*yield*/, this.cacheManager.del("tour:".concat(slug, ":").concat(l))];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        return AdminService_1;
    }());
    __setFunctionName(_classThis, "AdminService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AdminService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AdminService = _classThis;
}();
exports.AdminService = AdminService;
