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
exports.CompaniesService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var crypto_1 = require("crypto");
var utils_1 = require("../../common/utils");
var CompaniesService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var CompaniesService = _classThis = /** @class */ (function () {
        function CompaniesService_1(prisma) {
            this.prisma = prisma;
        }
        CompaniesService_1.prototype.generateReferenceCode = function (companyType) {
            var prefix = companyType === 'AGENCY'
                ? 'AGN'
                : companyType === 'CORPORATE'
                    ? 'COR'
                    : 'AFF';
            var year = new Date().getFullYear();
            var random = (0, crypto_1.randomBytes)(2).toString('hex').toUpperCase();
            return "".concat(prefix, "-").concat(year, "-").concat(random);
        };
        CompaniesService_1.prototype.create = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var referenceCode;
                return __generator(this, function (_a) {
                    referenceCode = this.generateReferenceCode(data.companyType || 'AGENCY');
                    return [2 /*return*/, this.prisma.company.create({
                            data: __assign(__assign({}, data), { referenceCode: referenceCode, commissionRate: data.commissionRate || 0, address: data.address
                                    ? data.address
                                    : client_1.Prisma.JsonNull, primaryContact: data.primaryContact
                                    ? data.primaryContact
                                    : client_1.Prisma.JsonNull, contractStartDate: data.contractStartDate
                                    ? new Date(data.contractStartDate)
                                    : null, contractEndDate: data.contractEndDate
                                    ? new Date(data.contractEndDate)
                                    : null }),
                        })];
                });
            });
        };
        CompaniesService_1.prototype.findAll = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, search, companyType, status, tag, segment, _c, sortBy, _d, sortOrder, skip, where, _e, total, data;
                var _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = filters.page, page = _a === void 0 ? 1 : _a, _b = filters.limit, limit = _b === void 0 ? 10 : _b, search = filters.search, companyType = filters.companyType, status = filters.status, tag = filters.tag, segment = filters.segment, _c = filters.sortBy, sortBy = _c === void 0 ? 'createdAt' : _c, _d = filters.sortOrder, sortOrder = _d === void 0 ? 'desc' : _d;
                            skip = (page - 1) * limit;
                            where = __assign(__assign(__assign(__assign(__assign({ deletedAt: null }, (companyType && { companyType: companyType })), (status && { status: status })), (tag && { tags: { has: tag } })), (segment && { segments: { has: segment } })), (search && {
                                OR: [
                                    { name: { contains: search, mode: 'insensitive' } },
                                    { referenceCode: { contains: search, mode: 'insensitive' } },
                                    { email: { contains: search, mode: 'insensitive' } },
                                ],
                            }));
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.company.count({ where: where }),
                                    this.prisma.company.findMany({
                                        where: where,
                                        skip: skip,
                                        take: limit,
                                        orderBy: (_f = {}, _f[sortBy] = sortOrder, _f),
                                        include: {
                                            _count: {
                                                select: { users: true, bookings: true },
                                            },
                                        },
                                    }),
                                ])];
                        case 1:
                            _e = _g.sent(), total = _e[0], data = _e[1];
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
        CompaniesService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var company;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.company.findUnique({
                                where: { id: id, deletedAt: null },
                                include: {
                                    users: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                            role: true,
                                            isVip: true,
                                            status: true,
                                        },
                                    },
                                    bookings: {
                                        orderBy: { createdAt: 'desc' },
                                        include: {
                                            payments: true,
                                            user: { select: { name: true, email: true } },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            company = _a.sent();
                            if (!company) {
                                throw new common_1.NotFoundException("Company with ID ".concat(id, " not found"));
                            }
                            return [2 /*return*/, company];
                    }
                });
            });
        };
        CompaniesService_1.prototype.update = function (id, data) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            _a.sent(); // Verify existence
                            return [2 /*return*/, this.prisma.company.update({
                                    where: { id: id },
                                    data: __assign(__assign({}, data), { address: data.address !== undefined
                                            ? data.address
                                            : undefined, primaryContact: data.primaryContact !== undefined
                                            ? data.primaryContact
                                            : undefined, contractStartDate: data.contractStartDate
                                            ? new Date(data.contractStartDate)
                                            : undefined, contractEndDate: data.contractEndDate
                                            ? new Date(data.contractEndDate)
                                            : undefined }),
                                })];
                    }
                });
            });
        };
        CompaniesService_1.prototype.softDelete = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, this.prisma.company.update({
                                    where: { id: id },
                                    data: {
                                        deletedAt: new Date(),
                                        status: client_1.CompanyStatus.INACTIVE,
                                    },
                                })];
                    }
                });
            });
        };
        CompaniesService_1.prototype.bulkUpdate = function (data) {
            return __awaiter(this, void 0, void 0, function () {
                var companyIds, status, tags, segments, updateData, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            companyIds = data.companyIds, status = data.status, tags = data.tags, segments = data.segments;
                            if (!companyIds || companyIds.length === 0) {
                                throw new common_1.BadRequestException('No company IDs provided');
                            }
                            updateData = {};
                            if (status !== undefined)
                                updateData.status = status;
                            if (tags !== undefined)
                                updateData.tags = { push: tags };
                            if (segments !== undefined)
                                updateData.segments = { push: segments };
                            if (Object.keys(updateData).length === 0) {
                                throw new common_1.BadRequestException('No update fields provided');
                            }
                            return [4 /*yield*/, this.prisma.company.updateMany({
                                    where: { id: { in: companyIds }, deletedAt: null },
                                    data: updateData,
                                })];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, { count: result.count }];
                    }
                });
            });
        };
        CompaniesService_1.prototype.getDashboardMetrics = function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, totalCompanies, activeAgencies, activeCorporate, totalOutstandingBalanceAgg, topPartners;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, Promise.all([
                                this.prisma.company.count({ where: { deletedAt: null } }),
                                this.prisma.company.count({
                                    where: { companyType: 'AGENCY', status: 'ACTIVE', deletedAt: null },
                                }),
                                this.prisma.company.count({
                                    where: { companyType: 'CORPORATE', status: 'ACTIVE', deletedAt: null },
                                }),
                                this.prisma.company.aggregate({
                                    where: { deletedAt: null, currentBalance: { gt: 0 } },
                                    _sum: { currentBalance: true },
                                }),
                            ])];
                        case 1:
                            _a = _b.sent(), totalCompanies = _a[0], activeAgencies = _a[1], activeCorporate = _a[2], totalOutstandingBalanceAgg = _a[3];
                            return [4 /*yield*/, this.prisma.company.findMany({
                                    where: { deletedAt: null },
                                    orderBy: { currentBalance: 'desc' },
                                    take: 5,
                                    select: {
                                        id: true,
                                        name: true,
                                        referenceCode: true,
                                        companyType: true,
                                        currentBalance: true,
                                        _count: { select: { bookings: true } },
                                    },
                                })];
                        case 2:
                            topPartners = _b.sent();
                            return [2 /*return*/, {
                                    totalCompanies: totalCompanies,
                                    activeAgencies: activeAgencies,
                                    activeCorporate: activeCorporate,
                                    totalOutstandingBalance: totalOutstandingBalanceAgg._sum.currentBalance || 0,
                                    topPartners: topPartners,
                                }];
                    }
                });
            });
        };
        CompaniesService_1.prototype.exportCsv = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var result, headers, rows;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findAll(__assign(__assign({}, filters), { limit: 10000, page: 1 }))];
                        case 1:
                            result = _a.sent();
                            if (!result.data.length) {
                                throw new common_1.BadRequestException('No data found to export');
                            }
                            headers = [
                                'ReferenceCode',
                                'Name',
                                'Type',
                                'Status',
                                'Email',
                                'Phone',
                                'CommissionRate',
                                'CurrentBalance',
                                'PaymentTerms',
                                'Tags',
                                'Segments',
                                'UsersCount',
                                'BookingsCount',
                                'RegisteredAt',
                            ];
                            rows = result.data.map(function (c) { return [
                                (0, utils_1.sanitizeCsvField)(c.referenceCode),
                                "\"".concat((0, utils_1.sanitizeCsvField)(c.name), "\""),
                                (0, utils_1.sanitizeCsvField)(c.companyType),
                                (0, utils_1.sanitizeCsvField)(c.status),
                                (0, utils_1.sanitizeCsvField)(c.email),
                                (0, utils_1.sanitizeCsvField)(c.phone),
                                (0, utils_1.sanitizeCsvField)("".concat(c.commissionRate, "%")),
                                (0, utils_1.sanitizeCsvField)(c.currentBalance),
                                (0, utils_1.sanitizeCsvField)(c.paymentTerms),
                                "\"".concat((0, utils_1.sanitizeCsvField)(c.tags.join(', ')), "\""),
                                "\"".concat((0, utils_1.sanitizeCsvField)(c.segments.join(', ')), "\""),
                                (0, utils_1.sanitizeCsvField)(c._count.users),
                                (0, utils_1.sanitizeCsvField)(c._count.bookings),
                                (0, utils_1.sanitizeCsvField)(c.createdAt.toISOString()),
                            ]; });
                            return [2 /*return*/, __spreadArray([headers.join(',')], rows.map(function (r) { return r.join(','); }), true).join('\n')];
                    }
                });
            });
        };
        return CompaniesService_1;
    }());
    __setFunctionName(_classThis, "CompaniesService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CompaniesService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CompaniesService = _classThis;
}();
exports.CompaniesService = CompaniesService;
