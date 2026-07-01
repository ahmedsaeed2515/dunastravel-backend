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
exports.UserService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var UserService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var UserService = _classThis = /** @class */ (function () {
        function UserService_1(prisma) {
            this.prisma = prisma;
            this.logger = new common_1.Logger(UserService.name);
        }
        UserService_1.prototype.findByEmail = function (email) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.user.findFirst({
                            where: { email: email, deletedAt: null },
                        })];
                });
            });
        };
        UserService_1.prototype.findById = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.user.findFirst({
                            where: { id: id, deletedAt: null },
                        })];
                });
            });
        };
        UserService_1.prototype.create = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var count, customerNumber, user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.count()];
                        case 1:
                            count = _a.sent();
                            customerNumber = "CUST-".concat(new Date().getFullYear(), "-").concat(String(count + 1).padStart(4, '0'));
                            return [4 /*yield*/, this.prisma.user.create({
                                    data: {
                                        name: data.name,
                                        email: data.email,
                                        phone: data.phone,
                                        passwordHash: data.passwordHash,
                                        role: data.role || client_1.UserRole.USER,
                                        customerNumber: customerNumber,
                                    },
                                })];
                        case 2:
                            user = _a.sent();
                            return [4 /*yield*/, this.prisma.customerActivityLog.create({
                                    data: {
                                        customerId: user.id,
                                        action: 'CUSTOMER_CREATED',
                                        details: { source: 'SYSTEM_REGISTRATION', role: user.role },
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, user];
                    }
                });
            });
        };
        UserService_1.prototype.update = function (id, data) {
            return __awaiter(this, void 0, void 0, function () {
                var user, existing;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.NotFoundException('User not found');
                            if (!(data.email && data.email !== user.email)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.findByEmail(data.email)];
                        case 2:
                            existing = _a.sent();
                            if (existing)
                                throw new common_1.ConflictException('Email already in use');
                            _a.label = 3;
                        case 3: return [2 /*return*/, this.prisma.user.update({
                                where: { id: id },
                                data: {
                                    name: data.name,
                                    email: data.email,
                                    phone: data.phone,
                                    passwordHash: data.passwordHash,
                                    role: data.role,
                                },
                            })];
                    }
                });
            });
        };
        UserService_1.prototype.findAll = function (options) {
            return __awaiter(this, void 0, void 0, function () {
                var page, limit, search, role, skip, where, _a, users, total, safeUsers;
                var _this = this;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            page = options.page, limit = options.limit, search = options.search, role = options.role;
                            skip = (page - 1) * limit;
                            where = __assign(__assign({ deletedAt: null }, (role && { role: role })), (search && {
                                OR: [
                                    { name: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                ],
                            }));
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.user.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: { createdAt: 'desc' },
                                    }),
                                    this.prisma.user.count({ where: where }),
                                ])];
                        case 1:
                            _a = _b.sent(), users = _a[0], total = _a[1];
                            safeUsers = users.map(function (user) { return _this.toSafeUser(user); });
                            return [2 /*return*/, { users: safeUsers, total: total }];
                    }
                });
            });
        };
        UserService_1.prototype.updateRefreshToken = function (id, refreshToken) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.update({
                                where: { id: id },
                                data: { refreshToken: refreshToken },
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UserService_1.prototype.softDelete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var user;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findById(id)];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                throw new common_1.NotFoundException('User not found');
                            }
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: id },
                                    data: { deletedAt: new Date(), status: 'INACTIVE' },
                                })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.customerActivityLog.create({
                                    data: {
                                        customerId: id,
                                        action: 'CUSTOMER_SOFT_DELETED',
                                        details: { softDelete: true },
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UserService_1.prototype.toSafeUser = function (user) {
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isVerified: user.isVerified,
                customerNumber: user.customerNumber,
                isVip: user.isVip,
                tags: user.tags,
                segments: user.segments,
                status: user.status,
                passportNumber: user.passportNumber,
                nationality: user.nationality,
                gender: user.gender,
                dateOfBirth: user.dateOfBirth,
                emergencyContact: user.emergencyContact,
                address: user.address,
                preferredLanguage: user.preferredLanguage,
                preferredCurrency: user.preferredCurrency,
                preferredDestination: user.preferredDestination,
                preferredTravelType: user.preferredTravelType,
                familyMembers: user.familyMembers,
                travelCompanions: user.travelCompanions,
                marketingConsent: user.marketingConsent,
                phoneVerified: user.phoneVerified,
                customerSource: user.customerSource,
                referralSource: user.referralSource,
                companyId: user.companyId,
                futureWalletId: user.futureWalletId,
                futureCommissionPlan: user.futureCommissionPlan,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };
        };
        // ─── ENTERPRISE CRM METHODS (PHASE 5) ────────────────────────
        UserService_1.prototype.getCrmDashboardMetrics = function (adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var now, thirtyDaysAgo, _a, totalCustomers, newCustomers, vipCustomers, customersWithBookingsData, topSpendersData, allBookings, returningCustomers, customersWithActiveBookings, customersWithOutstandingPayments, topSpendingCustomers, totalRevenue, averageBookingValue, lifetimeValue;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            this.logger.log("getCrmDashboardMetrics invoked by admin ".concat(adminUserId));
                            now = new Date();
                            thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.user.count({ where: { deletedAt: null, role: 'USER' } }),
                                    this.prisma.user.count({
                                        where: {
                                            deletedAt: null,
                                            role: 'USER',
                                            createdAt: { gte: thirtyDaysAgo },
                                        },
                                    }),
                                    this.prisma.user.count({
                                        where: { deletedAt: null, role: 'USER', isVip: true },
                                    }),
                                    this.prisma.user.findMany({
                                        where: {
                                            deletedAt: null,
                                            role: 'USER',
                                            bookings: { some: { deletedAt: null } },
                                        },
                                        select: {
                                            id: true,
                                            bookings: { select: { status: true, totalAmountUsd: true } },
                                        },
                                    }),
                                    this.prisma.user.findMany({
                                        where: {
                                            deletedAt: null,
                                            role: 'USER',
                                            bookings: {
                                                some: {
                                                    deletedAt: null,
                                                    status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
                                                },
                                            },
                                        },
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            isVip: true,
                                            customerNumber: true,
                                            bookings: { select: { totalAmountUsd: true, status: true } },
                                        },
                                    }),
                                    this.prisma.booking.findMany({
                                        where: {
                                            deletedAt: null,
                                            status: { in: ['CONFIRMED', 'PAID', 'COMPLETED'] },
                                        },
                                        select: { totalAmountUsd: true },
                                    }),
                                ])];
                        case 1:
                            _a = _b.sent(), totalCustomers = _a[0], newCustomers = _a[1], vipCustomers = _a[2], customersWithBookingsData = _a[3], topSpendersData = _a[4], allBookings = _a[5];
                            returningCustomers = 0;
                            customersWithActiveBookings = 0;
                            customersWithOutstandingPayments = 0;
                            customersWithBookingsData.forEach(function (user) {
                                if (user.bookings.length > 1) {
                                    returningCustomers++;
                                }
                                var hasActive = user.bookings.some(function (b) {
                                    return ['PENDING', 'CONFIRMED', 'PARTIALLY_PAID'].includes(b.status);
                                });
                                if (hasActive) {
                                    customersWithActiveBookings++;
                                }
                                var hasOutstanding = user.bookings.some(function (b) {
                                    return ['PENDING', 'CONFIRMED', 'PARTIALLY_PAID'].includes(b.status);
                                });
                                if (hasOutstanding) {
                                    customersWithOutstandingPayments++;
                                }
                            });
                            topSpendingCustomers = topSpendersData
                                .map(function (u) {
                                var totalSpent = u.bookings
                                    .filter(function (b) { return ['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status); })
                                    .reduce(function (sum, b) { return sum + Number(b.totalAmountUsd); }, 0);
                                return {
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    isVip: u.isVip,
                                    customerNumber: u.customerNumber,
                                    totalSpent: totalSpent,
                                };
                            })
                                .sort(function (a, b) { return b.totalSpent - a.totalSpent; })
                                .slice(0, 5);
                            totalRevenue = 0;
                            allBookings.forEach(function (b) {
                                totalRevenue += Number(b.totalAmountUsd);
                            });
                            averageBookingValue = allBookings.length > 0
                                ? Math.round(totalRevenue / allBookings.length)
                                : 0;
                            lifetimeValue = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;
                            return [2 /*return*/, {
                                    totalCustomers: totalCustomers,
                                    newCustomers: newCustomers,
                                    returningCustomers: returningCustomers,
                                    vipCustomers: vipCustomers,
                                    customersWithActiveBookings: customersWithActiveBookings,
                                    customersWithOutstandingPayments: customersWithOutstandingPayments,
                                    topSpendingCustomers: topSpendingCustomers,
                                    averageBookingValue: averageBookingValue,
                                    lifetimeValue: lifetimeValue,
                                    customerSatisfaction: 98.4, // Future Ready KPI
                                }];
                    }
                });
            });
        };
        UserService_1.prototype.findCustomersCrm = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, search, status, isVip, tag, segment, _c, sortBy, _d, sortOrder, where, skip, _e, total, records, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, search = query.search, status = query.status, isVip = query.isVip, tag = query.tag, segment = query.segment, _c = query.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = query.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            this.logger.log("findCustomersCrm invoked by admin ".concat(adminUserId));
                            where = { deletedAt: null, role: 'USER' };
                            if (status)
                                where.status = status;
                            if (isVip !== undefined)
                                where.isVip = isVip === 'true';
                            if (tag)
                                where.tags = { has: tag };
                            if (segment)
                                where.segments = { has: segment };
                            if (search) {
                                where.OR = [
                                    { name: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                    { phone: { contains: search, mode: 'insensitive' } },
                                    { passportNumber: { contains: search, mode: 'insensitive' } },
                                    { customerNumber: { contains: search, mode: 'insensitive' } },
                                ];
                            }
                            skip = (page - 1) * limit;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.user.count({ where: where }),
                                    this.prisma.user.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                        include: {
                                            bookings: {
                                                where: { deletedAt: null },
                                                select: {
                                                    totalAmountUsd: true,
                                                    status: true,
                                                    payments: { select: { amount: true, isRefund: true } },
                                                },
                                            },
                                            _count: {
                                                select: {
                                                    bookings: true,
                                                    customerNotes: true,
                                                    customerDocuments: true,
                                                },
                                            },
                                        },
                                    }),
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], records = _e[1];
                            data = records.map(function (u) {
                                var totalSpent = 0;
                                var totalPaid = 0;
                                u.bookings.forEach(function (b) {
                                    if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
                                        totalSpent += Number(b.totalAmountUsd);
                                    }
                                    b.payments.forEach(function (p) {
                                        if (!p.isRefund) {
                                            totalPaid += Number(p.amount);
                                        }
                                        else {
                                            totalPaid -= Number(p.amount);
                                        }
                                    });
                                });
                                var outstandingBalance = Math.max(0, totalSpent - totalPaid);
                                return {
                                    id: u.id,
                                    customerNumber: u.customerNumber || "CUST-2026-".concat(u.id.substring(0, 4).toUpperCase()),
                                    name: u.name,
                                    email: u.email,
                                    phone: u.phone,
                                    isVip: u.isVip,
                                    status: u.status,
                                    tags: u.tags,
                                    segments: u.segments,
                                    nationality: u.nationality,
                                    bookingsCount: u._count.bookings,
                                    notesCount: u._count.customerNotes,
                                    documentsCount: u._count.customerDocuments,
                                    totalSpent: totalSpent,
                                    outstandingBalance: outstandingBalance,
                                    createdAt: u.createdAt,
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
        UserService_1.prototype.getCustomerCrmDetail = function (id, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, customerNumber, totalSpent, totalPaid, tourCounts, favoriteTour, maxCount, outstandingBalance, averageSpend;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log("getCustomerCrmDetail invoked by admin ".concat(adminUserId, " for customer ").concat(id));
                            return [4 /*yield*/, this.prisma.user.findFirst({
                                    where: { id: id, deletedAt: null },
                                    include: {
                                        bookings: {
                                            where: { deletedAt: null },
                                            orderBy: { createdAt: 'desc' },
                                            include: {
                                                tour: { select: { slug: true, titleJsonb: true } },
                                                payments: true,
                                                invoice: true,
                                                passengers: true,
                                            },
                                        },
                                        customerNotes: {
                                            orderBy: { createdAt: 'desc' },
                                            include: { user: { select: { name: true, email: true } } },
                                        },
                                        customerDocuments: {
                                            orderBy: { createdAt: 'desc' },
                                        },
                                        customerActivityLogs: {
                                            orderBy: { createdAt: 'desc' },
                                            include: { user: { select: { name: true } } },
                                        },
                                    },
                                })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.NotFoundException("Customer with ID ".concat(id, " not found"));
                            customerNumber = user.customerNumber;
                            if (!!customerNumber) return [3 /*break*/, 3];
                            customerNumber = "CUST-2026-".concat(user.id.substring(0, 6).toUpperCase());
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: user.id },
                                    data: { customerNumber: customerNumber },
                                })];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            totalSpent = 0;
                            totalPaid = 0;
                            tourCounts = {};
                            favoriteTour = 'None';
                            user.bookings.forEach(function (b) {
                                if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
                                    totalSpent += Number(b.totalAmountUsd);
                                }
                                b.payments.forEach(function (p) {
                                    if (!p.isRefund) {
                                        totalPaid += Number(p.amount);
                                    }
                                    else {
                                        totalPaid -= Number(p.amount);
                                    }
                                });
                                var titleObj = b.tour.titleJsonb || {};
                                var tourName = titleObj['en'] || b.tour.slug;
                                tourCounts[tourName] = (tourCounts[tourName] || 0) + 1;
                            });
                            maxCount = 0;
                            Object.entries(tourCounts).forEach(function (_a) {
                                var tourName = _a[0], count = _a[1];
                                if (count > maxCount) {
                                    maxCount = count;
                                    favoriteTour = tourName;
                                }
                            });
                            outstandingBalance = Math.max(0, totalSpent - totalPaid);
                            averageSpend = user.bookings.length > 0
                                ? Math.round(totalSpent / user.bookings.length)
                                : 0;
                            return [2 /*return*/, __assign(__assign({}, this.toSafeUser(user)), { customerNumber: customerNumber, totalSpent: totalSpent, totalPaid: totalPaid, outstandingBalance: outstandingBalance, averageSpend: averageSpend, favoriteTour: favoriteTour, bookings: user.bookings.map(function (b) {
                                        var _a;
                                        return (__assign(__assign({}, b), { totalAmountUsd: b.totalAmountUsd.toString(), tourNameEn: ((_a = b.tour.titleJsonb) === null || _a === void 0 ? void 0 : _a['en']) || b.tour.slug, payments: b.payments.map(function (p) { return (__assign(__assign({}, p), { amount: p.amount.toString() })); }) }));
                                    }), notes: user.customerNotes.map(function (n) { return ({
                                        id: n.id,
                                        content: n.content,
                                        noteType: n.noteType,
                                        isPinned: n.isPinned,
                                        createdAt: n.createdAt,
                                        authorName: n.user.name,
                                    }); }), documents: user.customerDocuments, timeline: user.customerActivityLogs.map(function (l) {
                                        var _a;
                                        return ({
                                            id: l.id,
                                            action: l.action,
                                            details: l.details,
                                            createdAt: l.createdAt,
                                            authorName: ((_a = l.user) === null || _a === void 0 ? void 0 : _a.name) || 'System',
                                        });
                                    }) })];
                    }
                });
            });
        };
        UserService_1.prototype.updateCustomerCrm = function (id, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, updated;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: { id: id, deletedAt: null },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.NotFoundException('Customer not found');
                            return [4 /*yield*/, this.prisma.user.update({
                                    where: { id: id },
                                    data: __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (dto.customerNumber && { customerNumber: dto.customerNumber })), (dto.isVip !== undefined && { isVip: dto.isVip })), (dto.tags && { tags: dto.tags })), (dto.segments && { segments: dto.segments })), (dto.status && { status: dto.status })), (dto.passportNumber !== undefined && {
                                        passportNumber: dto.passportNumber,
                                    })), (dto.nationality !== undefined && { nationality: dto.nationality })), (dto.gender !== undefined && { gender: dto.gender })), (dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) })), (dto.emergencyContact && { emergencyContact: dto.emergencyContact })), (dto.address && { address: dto.address })), (dto.preferredLanguage && {
                                        preferredLanguage: dto.preferredLanguage,
                                    })), (dto.preferredCurrency && {
                                        preferredCurrency: dto.preferredCurrency,
                                    })), (dto.preferredDestination && {
                                        preferredDestination: dto.preferredDestination,
                                    })), (dto.preferredTravelType && {
                                        preferredTravelType: dto.preferredTravelType,
                                    })), (dto.familyMembers && { familyMembers: dto.familyMembers })), (dto.travelCompanions && { travelCompanions: dto.travelCompanions })), (dto.marketingConsent !== undefined && {
                                        marketingConsent: dto.marketingConsent,
                                    })), (dto.phoneVerified !== undefined && {
                                        phoneVerified: dto.phoneVerified,
                                    })), (dto.customerSource && { customerSource: dto.customerSource })), (dto.referralSource && { referralSource: dto.referralSource })), (dto.futureCompanyId && { futureCompanyId: dto.futureCompanyId })), (dto.futureWalletId && { futureWalletId: dto.futureWalletId })), (dto.futureCommissionPlan && {
                                        futureCommissionPlan: dto.futureCommissionPlan,
                                    })),
                                })];
                        case 2:
                            updated = _a.sent();
                            return [4 /*yield*/, this.prisma.customerActivityLog.create({
                                    data: {
                                        customerId: id,
                                        userId: adminUserId,
                                        action: 'PROFILE_UPDATED',
                                        details: dto,
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, this.toSafeUser(updated)];
                    }
                });
            });
        };
        UserService_1.prototype.bulkUpdateCustomers = function (dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var data, count;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            data = {};
                            if (dto.tags)
                                data.tags = dto.tags;
                            if (dto.segments)
                                data.segments = dto.segments;
                            if (dto.isVip !== undefined)
                                data.isVip = dto.isVip;
                            if (dto.status)
                                data.status = dto.status;
                            if (Object.keys(data).length === 0)
                                return [2 /*return*/, { count: 0 }];
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var result, users;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.user.updateMany({
                                                    where: { id: { in: dto.userIds }, deletedAt: null },
                                                    data: data,
                                                })];
                                            case 1:
                                                result = _a.sent();
                                                return [4 /*yield*/, tx.user.findMany({
                                                        where: { id: { in: dto.userIds } },
                                                        select: { id: true },
                                                    })];
                                            case 2:
                                                users = _a.sent();
                                                if (!(users.length > 0)) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.customerActivityLog.createMany({
                                                        data: users.map(function (u) { return ({
                                                            customerId: u.id,
                                                            userId: adminUserId,
                                                            action: 'BULK_UPDATE',
                                                            details: data,
                                                        }); }),
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
        UserService_1.prototype.addCustomerNote = function (id, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, note;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: { id: id, deletedAt: null },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.NotFoundException('Customer not found');
                            return [4 /*yield*/, this.prisma.customerNote.create({
                                    data: {
                                        customerId: id,
                                        userId: adminUserId,
                                        content: dto.content,
                                        noteType: dto.noteType || 'INTERNAL',
                                        isPinned: dto.isPinned || false,
                                    },
                                    include: { user: { select: { name: true } } },
                                })];
                        case 2:
                            note = _a.sent();
                            return [4 /*yield*/, this.prisma.customerActivityLog.create({
                                    data: {
                                        customerId: id,
                                        userId: adminUserId,
                                        action: 'NOTE_ADDED',
                                        details: { noteId: note.id, noteType: note.noteType },
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, {
                                    id: note.id,
                                    content: note.content,
                                    noteType: note.noteType,
                                    isPinned: note.isPinned,
                                    createdAt: note.createdAt,
                                    authorName: note.user.name,
                                }];
                    }
                });
            });
        };
        UserService_1.prototype.addCustomerDocument = function (id, dto, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var user, doc;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.user.findFirst({
                                where: { id: id, deletedAt: null },
                            })];
                        case 1:
                            user = _a.sent();
                            if (!user)
                                throw new common_1.NotFoundException('Customer not found');
                            return [4 /*yield*/, this.prisma.customerDocument.create({
                                    data: {
                                        customerId: id,
                                        mediaAssetId: dto.mediaAssetId,
                                        documentType: dto.documentType || 'OTHER',
                                        title: dto.title,
                                        uploadedBy: adminUserId,
                                    },
                                })];
                        case 2:
                            doc = _a.sent();
                            return [4 /*yield*/, this.prisma.customerActivityLog.create({
                                    data: {
                                        customerId: id,
                                        userId: adminUserId,
                                        action: 'DOCUMENT_UPLOADED',
                                        details: {
                                            documentId: doc.id,
                                            documentType: doc.documentType,
                                            title: doc.title,
                                        },
                                    },
                                })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, doc];
                    }
                });
            });
        };
        UserService_1.prototype.exportCustomersCsv = function (query, adminUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var search, status, isVip, tag, segment, _a, sortBy, _b, sortOrder, where, headers, rows, skip, batchSize, hasMore, batch, _loop_1, _i, batch_1, u;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            search = query.search, status = query.status, isVip = query.isVip, tag = query.tag, segment = query.segment, _a = query.sortBy, sortBy = _a === void 0 ? 'createdAt' : _a, _b = query.sortOrder, sortOrder = _b === void 0 ? 'desc' : _b;
                            this.logger.log("exportCustomersCsv invoked by admin ".concat(adminUserId));
                            where = { deletedAt: null, role: 'USER' };
                            if (status)
                                where.status = status;
                            if (isVip !== undefined)
                                where.isVip = isVip === 'true';
                            if (tag)
                                where.tags = { has: tag };
                            if (segment)
                                where.segments = { has: segment };
                            if (search) {
                                where.OR = [
                                    { name: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                    { phone: { contains: search, mode: 'insensitive' } },
                                    { passportNumber: { contains: search, mode: 'insensitive' } },
                                    { customerNumber: { contains: search, mode: 'insensitive' } },
                                ];
                            }
                            headers = [
                                'Customer Number',
                                'Name',
                                'Email',
                                'Phone',
                                'VIP',
                                'Status',
                                'Nationality',
                                'Total Spent (USD)',
                                'Outstanding Balance (USD)',
                                'Created At',
                            ];
                            rows = [];
                            skip = 0;
                            batchSize = 1000;
                            hasMore = true;
                            _d.label = 1;
                        case 1:
                            if (!hasMore) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.user.findMany({
                                    where: where,
                                    skip: skip,
                                    take: batchSize,
                                    orderBy: (_c = {}, _c[sortBy] = sortOrder, _c),
                                    include: {
                                        bookings: {
                                            where: { deletedAt: null },
                                            select: {
                                                totalAmountUsd: true,
                                                status: true,
                                                payments: { select: { amount: true, isRefund: true } },
                                            },
                                        },
                                    },
                                })];
                        case 2:
                            batch = _d.sent();
                            _loop_1 = function (u) {
                                var totalSpent = 0;
                                var totalPaid = 0;
                                u.bookings.forEach(function (b) {
                                    if (['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status)) {
                                        totalSpent += Number(b.totalAmountUsd);
                                    }
                                    b.payments.forEach(function (p) {
                                        if (!p.isRefund) {
                                            totalPaid += Number(p.amount);
                                        }
                                        else {
                                            totalPaid -= Number(p.amount);
                                        }
                                    });
                                });
                                var outstandingBalance = Math.max(0, totalSpent - totalPaid);
                                rows.push([
                                    u.customerNumber || "CUST-2026-".concat(u.id.substring(0, 4).toUpperCase()),
                                    u.name,
                                    u.email,
                                    u.phone || 'N/A',
                                    u.isVip ? 'YES' : 'NO',
                                    u.status,
                                    u.nationality || 'N/A',
                                    totalSpent.toString(),
                                    outstandingBalance.toString(),
                                    u.createdAt.toISOString().split('T')[0],
                                ]);
                            };
                            for (_i = 0, batch_1 = batch; _i < batch_1.length; _i++) {
                                u = batch_1[_i];
                                _loop_1(u);
                            }
                            skip += batchSize;
                            if (batch.length < batchSize) {
                                hasMore = false;
                            }
                            return [3 /*break*/, 1];
                        case 3:
                            this.logger.log("exportCustomersCsv invoked by admin ".concat(adminUserId, ". Exported ").concat(rows.length, " records via batching."));
                            return [2 /*return*/, __spreadArray([
                                    headers.join(',')
                                ], rows.map(function (r) { return r.map(function (c) { return "\"".concat(c, "\""); }).join(','); }), true).join('\n')];
                    }
                });
            });
        };
        return UserService_1;
    }());
    __setFunctionName(_classThis, "UserService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UserService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UserService = _classThis;
}();
exports.UserService = UserService;
