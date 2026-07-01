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
exports.ToursService = void 0;
var common_1 = require("@nestjs/common");
var utils_1 = require("../../common/utils");
var ToursService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ToursService = _classThis = /** @class */ (function () {
        function ToursService_1(prisma, cacheManager, toursCounter) {
            this.prisma = prisma;
            this.cacheManager = cacheManager;
            this.toursCounter = toursCounter;
            this.logger = new common_1.Logger(ToursService.name);
        }
        ToursService_1.prototype.findAll = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, skip, take, page, limit, where, _b, total, records, mappedItems;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = (0, utils_1.getPaginationParams)(query.page, query.limit), skip = _a.skip, take = _a.take, page = _a.page, limit = _a.limit;
                            where = { isActive: true };
                            if (query.category) {
                                where.category = { equals: query.category, mode: 'insensitive' };
                            }
                            return [4 /*yield*/, this.prisma.$transaction([
                                    this.prisma.tour.count({ where: where }),
                                    this.prisma.tour.findMany({
                                        where: where,
                                        skip: skip,
                                        take: take,
                                        orderBy: { createdAt: 'desc' },
                                        select: {
                                            id: true,
                                            slug: true,
                                            titleJsonb: true,
                                            category: true,
                                            basePriceUsd: true,
                                            durationJsonb: true,
                                            images: {
                                                where: { isHero: true },
                                                take: 1,
                                                orderBy: { sortOrder: 'asc' },
                                                select: { imageUrl: true },
                                            },
                                        },
                                    }),
                                ])];
                        case 1:
                            _b = _d.sent(), total = _b[0], records = _b[1];
                            this.logger.debug("Tours catalog queried | category=".concat((_c = query.category) !== null && _c !== void 0 ? _c : 'all', " lang=").concat(query.lang, " page=").concat(page, " limit=").concat(limit));
                            mappedItems = records.map(function (record) {
                                var _a, _b;
                                return ({
                                    id: record.id,
                                    slug: record.slug,
                                    title: (0, utils_1.extractI18n)(record.titleJsonb, query.lang),
                                    category: record.category,
                                    basePriceUsd: record.basePriceUsd.toString(),
                                    duration: (0, utils_1.extractI18n)(record.durationJsonb, query.lang),
                                    heroImage: (_b = (_a = record.images[0]) === null || _a === void 0 ? void 0 : _a.imageUrl) !== null && _b !== void 0 ? _b : null,
                                });
                            });
                            return [2 /*return*/, (0, utils_1.paginate)(mappedItems, total, page, limit)];
                    }
                });
            });
        };
        ToursService_1.prototype.findBySlug = function (slug, lang) {
            return __awaiter(this, void 0, void 0, function () {
                var cacheKey, cached, tour, itinerary, images, response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.toursCounter.inc();
                            cacheKey = "tour:".concat(slug, ":").concat(lang);
                            return [4 /*yield*/, this.cacheManager.get(cacheKey)];
                        case 1:
                            cached = _a.sent();
                            if (cached) {
                                return [2 /*return*/, cached];
                            }
                            return [4 /*yield*/, this.prisma.tour.findFirst({
                                    where: { slug: slug, isActive: true },
                                    include: {
                                        itineraries: { orderBy: { sortOrder: 'asc' } },
                                        images: { orderBy: { sortOrder: 'asc' } },
                                    },
                                })];
                        case 2:
                            tour = _a.sent();
                            if (!tour) {
                                this.logger.warn("Tour not found | slug=".concat(slug));
                                throw new common_1.NotFoundException('Tour not found');
                            }
                            this.logger.debug("Tour detail queried | slug=".concat(slug, " lang=").concat(lang));
                            itinerary = tour.itineraries.map(function (it) { return ({
                                id: it.id,
                                dayLabel: it.dayLabel,
                                description: (0, utils_1.extractI18n)(it.descriptionJsonb, lang),
                                meals: it.mealsJsonb ? (0, utils_1.extractI18n)(it.mealsJsonb, lang) || null : null,
                                sortOrder: it.sortOrder,
                            }); });
                            images = tour.images.map(function (img) { return ({
                                id: img.id,
                                imageUrl: img.imageUrl,
                                isHero: img.isHero,
                                altText: img.altText,
                                sortOrder: img.sortOrder,
                            }); });
                            response = {
                                id: tour.id,
                                slug: tour.slug,
                                title: (0, utils_1.extractI18n)(tour.titleJsonb, lang),
                                category: tour.category,
                                basePriceUsd: tour.basePriceUsd.toString(),
                                duration: (0, utils_1.extractI18n)(tour.durationJsonb, lang),
                                overview: (0, utils_1.extractI18n)(tour.overviewJsonb, lang),
                                itinerary: itinerary,
                                images: images,
                            };
                            return [4 /*yield*/, this.cacheManager.set(cacheKey, response, 300)];
                        case 3:
                            _a.sent(); // cache for 5 minutes
                            return [2 /*return*/, response];
                    }
                });
            });
        };
        ToursService_1.prototype.update = function (slug, data) {
            return __awaiter(this, void 0, void 0, function () {
                var updated, langs, _i, langs_1, l;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.tour.update({
                                where: { slug: slug },
                                data: data,
                            })];
                        case 1:
                            updated = _a.sent();
                            langs = ['en', 'es', 'pt', 'it', 'ar'];
                            _i = 0, langs_1 = langs;
                            _a.label = 2;
                        case 2:
                            if (!(_i < langs_1.length)) return [3 /*break*/, 5];
                            l = langs_1[_i];
                            return [4 /*yield*/, this.cacheManager.del("tour:".concat(slug, ":").concat(l))];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/, updated];
                    }
                });
            });
        };
        ToursService_1.prototype.remove = function (slug) {
            return __awaiter(this, void 0, void 0, function () {
                var deleted, langs, _i, langs_2, l;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.tour.delete({
                                where: { slug: slug },
                            })];
                        case 1:
                            deleted = _a.sent();
                            langs = ['en', 'es', 'pt', 'it', 'ar'];
                            _i = 0, langs_2 = langs;
                            _a.label = 2;
                        case 2:
                            if (!(_i < langs_2.length)) return [3 /*break*/, 5];
                            l = langs_2[_i];
                            return [4 /*yield*/, this.cacheManager.del("tour:".concat(slug, ":").concat(l))];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/, deleted];
                    }
                });
            });
        };
        return ToursService_1;
    }());
    __setFunctionName(_classThis, "ToursService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ToursService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ToursService = _classThis;
}();
exports.ToursService = ToursService;
