"use strict";
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
exports.CommissionsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var CommissionsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var CommissionsService = _classThis = /** @class */ (function () {
        function CommissionsService_1(prisma, walletsService) {
            this.prisma = prisma;
            this.walletsService = walletsService;
            this.logger = new common_1.Logger(CommissionsService.name);
        }
        CommissionsService_1.prototype.createCommission = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, _a, booking, company, expectedAmount, tolerance, diff;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.commission.findUnique({
                                where: { bookingId: data.bookingId },
                            })];
                        case 1:
                            existing = _b.sent();
                            if (existing) {
                                throw new common_1.BadRequestException('Commission already exists for this booking.');
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.booking.findUnique({
                                        where: { id: data.bookingId },
                                        select: { totalAmountUsd: true },
                                    }),
                                    this.prisma.company.findUnique({
                                        where: { id: data.companyId },
                                        select: { commissionRate: true },
                                    }),
                                ])];
                        case 2:
                            _a = _b.sent(), booking = _a[0], company = _a[1];
                            if (!booking)
                                throw new common_1.BadRequestException('Booking not found');
                            if (!company)
                                throw new common_1.BadRequestException('Company not found');
                            expectedAmount = booking.totalAmountUsd
                                .mul(company.commissionRate)
                                .div(100);
                            tolerance = 0.01;
                            diff = Math.abs(Number(data.amount) - Number(expectedAmount));
                            if (diff > tolerance) {
                                this.logger.warn("Commission amount mismatch: submitted=".concat(data.amount, " expected=").concat(expectedAmount, " bookingId=").concat(data.bookingId));
                                throw new common_1.BadRequestException("Commission amount ".concat(data.amount, " does not match expected ").concat(expectedAmount, " (").concat(company.commissionRate, "% of ").concat(booking.totalAmountUsd, "). Please verify the amount."));
                            }
                            return [2 /*return*/, this.prisma.commission.create({
                                    data: {
                                        companyId: data.companyId,
                                        bookingId: data.bookingId,
                                        rate: data.rate,
                                        amount: data.amount,
                                        status: client_1.CommissionStatus.PENDING,
                                    },
                                })];
                    }
                });
            });
        };
        CommissionsService_1.prototype.updateCommissionStatus = function (id, data) {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var commission, updated;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx.commission.findUnique({ where: { id: id } })];
                                    case 1:
                                        commission = _a.sent();
                                        if (!commission)
                                            throw new common_1.NotFoundException('Commission not found');
                                        // If no change, return
                                        if (commission.status === data.status)
                                            return [2 /*return*/, commission];
                                        return [4 /*yield*/, tx.commission.update({
                                                where: { id: id },
                                                data: { status: data.status },
                                            })];
                                    case 2:
                                        updated = _a.sent();
                                        // If transitioning to APPROVED, credit the company's wallet
                                        if (data.status === client_1.CommissionStatus.APPROVED &&
                                            commission.status === client_1.CommissionStatus.PENDING) {
                                            // We use the WalletsService for consistency, but we pass `tx` implicitly if we could.
                                            // Actually, since WalletsService uses its own $transaction, it's safer to just call it.
                                            // But doing it outside this tx is better to avoid nested tx issues in Prisma.
                                        }
                                        return [2 /*return*/, updated];
                                }
                            });
                        }); })];
                });
            });
        };
        // Helper function to trigger wallet credit. Should be called after the transaction commits.
        CommissionsService_1.prototype.processCommissionApproval = function (commissionId) {
            return __awaiter(this, void 0, void 0, function () {
                var commission;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.commission.findUnique({
                                where: { id: commissionId },
                            })];
                        case 1:
                            commission = _a.sent();
                            if (!((commission === null || commission === void 0 ? void 0 : commission.status) === client_1.CommissionStatus.APPROVED)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.walletsService.addTransaction({
                                    ownerType: client_1.WalletOwnerType.COMPANY,
                                    ownerId: commission.companyId,
                                    amount: Number(commission.amount),
                                    type: client_1.WalletTransactionType.CREDIT,
                                    referenceType: 'COMMISSION',
                                    referenceId: commission.id,
                                    description: "Commission for Booking ".concat(commission.bookingId),
                                    status: client_1.WalletTransactionStatus.COMPLETED,
                                })];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        CommissionsService_1.prototype.findAll = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, companyId, bookingId, status, skip, where, _c, data, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = filters.page, page = _a === void 0 ? 1 : _a, _b = filters.limit, limit = _b === void 0 ? 10 : _b, companyId = filters.companyId, bookingId = filters.bookingId, status = filters.status;
                            skip = (page - 1) * limit;
                            where = {};
                            if (companyId)
                                where.companyId = companyId;
                            if (bookingId)
                                where.bookingId = bookingId;
                            if (status)
                                where.status = status;
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.commission.findMany({
                                        where: where,
                                        include: {
                                            company: { select: { name: true, referenceCode: true } },
                                            booking: { select: { referenceCode: true, totalAmountUsd: true } },
                                        },
                                        skip: skip,
                                        take: Number(limit),
                                        orderBy: { createdAt: 'desc' },
                                    }),
                                    this.prisma.commission.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), data = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    data: data,
                                    meta: {
                                        total: total,
                                        page: page,
                                        limit: limit,
                                        totalPages: Math.ceil(total / limit),
                                    },
                                }];
                    }
                });
            });
        };
        CommissionsService_1.prototype.getMetrics = function () {
            return __awaiter(this, void 0, void 0, function () {
                var totalPendingAgg, totalApprovedAgg, pendingCount;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.commission.aggregate({
                                where: { status: client_1.CommissionStatus.PENDING },
                                _sum: { amount: true },
                            })];
                        case 1:
                            totalPendingAgg = _a.sent();
                            return [4 /*yield*/, this.prisma.commission.aggregate({
                                    where: { status: client_1.CommissionStatus.APPROVED },
                                    _sum: { amount: true },
                                })];
                        case 2:
                            totalApprovedAgg = _a.sent();
                            return [4 /*yield*/, this.prisma.commission.count({
                                    where: { status: client_1.CommissionStatus.PENDING },
                                })];
                        case 3:
                            pendingCount = _a.sent();
                            return [2 /*return*/, {
                                    totalPendingUsd: Number(totalPendingAgg._sum.amount || 0),
                                    totalApprovedUsd: Number(totalApprovedAgg._sum.amount || 0),
                                    pendingCount: pendingCount,
                                }];
                    }
                });
            });
        };
        return CommissionsService_1;
    }());
    __setFunctionName(_classThis, "CommissionsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CommissionsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CommissionsService = _classThis;
}();
exports.CommissionsService = CommissionsService;
