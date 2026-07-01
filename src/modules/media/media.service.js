"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.MediaService = void 0;
var fs = __importStar(require("fs"));
var common_1 = require("@nestjs/common");
var schedule_1 = require("@nestjs/schedule");
var client_1 = require("@prisma/client");
var media_events_interface_1 = require("./interfaces/media-events.interface");
var MediaService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _cleanupOrphanedAssets_decorators;
    var MediaService = _classThis = /** @class */ (function () {
        function MediaService_1(prisma, storageProvider, configService, eventEmitter) {
            this.prisma = (__runInitializers(this, _instanceExtraInitializers), prisma);
            this.storageProvider = storageProvider;
            this.configService = configService;
            this.eventEmitter = eventEmitter;
            this.logger = new common_1.Logger(MediaService.name);
        }
        MediaService_1.prototype.uploadAsset = function (file, dto, uploadedByUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var folder, eager, options, attempt, maxAttempts, result, mediaAsset, dbError_1, cleanupError_1, eventPayload;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug("Upload initiated { entityType: ".concat(dto.entityType, ", entityId: ").concat(dto.entityId, ", mimeType: ").concat(file.mimetype, ", bytes: ").concat(file.size, " }"));
                            folder = this.configService.get('storage.uploadFolder') || 'dunas-travel';
                            eager = [
                                {
                                    width: 1920,
                                    crop: 'limit',
                                    format: 'webp',
                                    quality: 'auto',
                                },
                            ];
                            options = {
                                folder: folder,
                                entityType: dto.entityType,
                                entityId: dto.entityId,
                                altText: dto.altText,
                                eager: eager,
                            };
                            attempt = 0;
                            maxAttempts = 3;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, , 7, 8]);
                            _a.label = 2;
                        case 2:
                            if (!(attempt < maxAttempts)) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.storageProvider.upload(file, options)];
                        case 3:
                            result = _a.sent();
                            if (result.success) {
                                return [3 /*break*/, 6];
                            }
                            attempt++;
                            if (!(attempt < maxAttempts)) return [3 /*break*/, 5];
                            this.logger.warn("Upload retry { attempt: ".concat(attempt, ", error: ").concat(result.error, ", entityType: ").concat(dto.entityType, " }"));
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500 * attempt); })];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5: return [3 /*break*/, 2];
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            if (file.path) {
                                fs.unlink(file.path, function (err) {
                                    if (err)
                                        _this.logger.error("Failed to delete temp file ".concat(file.path, ": ").concat(err.message));
                                });
                            }
                            return [7 /*endfinally*/];
                        case 8:
                            if (!result || !result.success) {
                                this.logger.error("Upload failed after max retries { attempts: ".concat(maxAttempts, ", error: ").concat(result === null || result === void 0 ? void 0 : result.error, " }"));
                                throw new common_1.HttpException("Failed to upload media: ".concat(result === null || result === void 0 ? void 0 : result.error), common_1.HttpStatus.BAD_GATEWAY);
                            }
                            _a.label = 9;
                        case 9:
                            _a.trys.push([9, 11, , 16]);
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var asset, existingImages, nextSortOrder, isHero;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, tx.mediaAsset.create({
                                                    data: {
                                                        publicId: result.publicId,
                                                        url: result.url,
                                                        secureUrl: result.secureUrl,
                                                        providerName: 'cloudinary', // Cloudinary is the sole provider for now
                                                        format: result.format,
                                                        mimeType: file.mimetype,
                                                        bytes: result.bytes,
                                                        width: result.width,
                                                        height: result.height,
                                                        entityType: dto.entityType,
                                                        entityId: dto.entityId,
                                                        provenance: client_1.MediaProvenance.UPLOADED,
                                                        altText: dto.altText,
                                                        uploadedBy: uploadedByUserId,
                                                    },
                                                })];
                                            case 1:
                                                asset = _a.sent();
                                                this.logger.debug("MediaAsset created { id: ".concat(asset.id, ", publicId: ").concat(asset.publicId, " }"));
                                                if (!(dto.entityType === client_1.MediaEntityType.TOUR && dto.entityId)) return [3 /*break*/, 4];
                                                return [4 /*yield*/, tx.tourImage.findMany({
                                                        where: { tourId: dto.entityId },
                                                        orderBy: { sortOrder: 'desc' },
                                                        take: 1,
                                                    })];
                                            case 2:
                                                existingImages = _a.sent();
                                                nextSortOrder = existingImages.length > 0 ? existingImages[0].sortOrder + 1 : 0;
                                                isHero = nextSortOrder === 0;
                                                return [4 /*yield*/, tx.tourImage.create({
                                                        data: {
                                                            tourId: dto.entityId,
                                                            imageUrl: asset.secureUrl,
                                                            isHero: isHero,
                                                            altText: asset.altText,
                                                            sortOrder: nextSortOrder,
                                                        },
                                                    })];
                                            case 3:
                                                _a.sent();
                                                this.logger.debug("TourImage upserted { tourId: ".concat(dto.entityId, " }"));
                                                _a.label = 4;
                                            case 4: return [2 /*return*/, asset];
                                        }
                                    });
                                }); })];
                        case 10:
                            mediaAsset = _a.sent();
                            return [3 /*break*/, 16];
                        case 11:
                            dbError_1 = _a.sent();
                            this.logger.error("Database transaction failed during upload { error: ".concat(dbError_1.message, " }"));
                            this.logger.warn("Cleaning up orphaned asset on storage provider: ".concat(result.publicId));
                            _a.label = 12;
                        case 12:
                            _a.trys.push([12, 14, , 15]);
                            return [4 /*yield*/, this.storageProvider.delete(result.publicId)];
                        case 13:
                            _a.sent();
                            return [3 /*break*/, 15];
                        case 14:
                            cleanupError_1 = _a.sent();
                            this.logger.error("Failed to cleanup orphaned asset ".concat(result.publicId, ": ").concat(cleanupError_1.message));
                            return [3 /*break*/, 15];
                        case 15: throw dbError_1;
                        case 16:
                            eventPayload = {
                                assetId: mediaAsset.id,
                                publicId: mediaAsset.publicId,
                                entityType: mediaAsset.entityType,
                                entityId: mediaAsset.entityId,
                                uploadedBy: mediaAsset.uploadedBy,
                                url: mediaAsset.secureUrl,
                                occurredAt: mediaAsset.createdAt,
                            };
                            this.eventEmitter.emit(media_events_interface_1.MEDIA_UPLOADED_EVENT, eventPayload);
                            this.logger.debug("media.uploaded event emitted { assetId: ".concat(mediaAsset.id, " }"));
                            return [2 /*return*/, mediaAsset];
                    }
                });
            });
        };
        MediaService_1.prototype.deleteAsset = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var asset, deletedAt, providerDeleteFailed, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug("Delete initiated { id: ".concat(id, " }"));
                            return [4 /*yield*/, this.prisma.mediaAsset.findFirst({
                                    where: { id: id, deletedAt: null },
                                })];
                        case 1:
                            asset = _a.sent();
                            if (!asset) {
                                throw new common_1.NotFoundException("Media asset with ID ".concat(id, " not found or already deleted"));
                            }
                            deletedAt = new Date();
                            return [4 /*yield*/, this.prisma.mediaAsset.update({
                                    where: { id: id },
                                    data: { deletedAt: deletedAt },
                                })];
                        case 2:
                            _a.sent();
                            if (!(asset.entityType === client_1.MediaEntityType.TOUR && asset.entityId)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.tourImage.deleteMany({
                                    where: {
                                        tourId: asset.entityId,
                                        imageUrl: asset.secureUrl, // match by URL since there's no FK on MediaAsset id
                                    },
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            providerDeleteFailed = false;
                            _a.label = 5;
                        case 5:
                            _a.trys.push([5, 7, , 8]);
                            return [4 /*yield*/, this.storageProvider.delete(asset.publicId)];
                        case 6:
                            _a.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            error_1 = _a.sent();
                            this.logger.warn("Cloud provider delete failed, record soft-deleted { id: ".concat(id, ", error: ").concat(error_1.message, " }"));
                            providerDeleteFailed = true;
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/, {
                                id: asset.id,
                                deletedAt: deletedAt,
                                providerDeleteFailed: providerDeleteFailed,
                            }];
                    }
                });
            });
        };
        MediaService_1.prototype.listAssets = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, entityType, entityId, _c, includeDeleted, where, _d, assets, total;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _a = query.page, page = _a === void 0 ? 1 : _a, _b = query.limit, limit = _b === void 0 ? 20 : _b, entityType = query.entityType, entityId = query.entityId, _c = query.includeDeleted, includeDeleted = _c === void 0 ? false : _c;
                            where = {};
                            if (!includeDeleted) {
                                where.deletedAt = null;
                            }
                            if (entityType) {
                                where.entityType = entityType;
                            }
                            if (entityId) {
                                where.entityId = entityId;
                            }
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.mediaAsset.findMany({
                                        where: where,
                                        skip: (page - 1) * limit,
                                        take: limit,
                                        orderBy: { createdAt: 'desc' },
                                    }),
                                    this.prisma.mediaAsset.count({ where: where }),
                                ])];
                        case 1:
                            _d = _e.sent(), assets = _d[0], total = _d[1];
                            this.logger.debug("List assets queried { filters: ".concat(JSON.stringify(where), ", total: ").concat(total, " }"));
                            return [2 /*return*/, {
                                    data: assets,
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
        MediaService_1.prototype.getAssetsByTourId = function (tourId) {
            return __awaiter(this, void 0, void 0, function () {
                var assets;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.mediaAsset.findMany({
                                where: {
                                    entityType: client_1.MediaEntityType.TOUR,
                                    entityId: tourId,
                                    deletedAt: null,
                                },
                                orderBy: { createdAt: 'asc' },
                            })];
                        case 1:
                            assets = _a.sent();
                            this.logger.debug("Tour assets queried { tourId: ".concat(tourId, ", count: ").concat(assets.length, " }"));
                            return [2 /*return*/, assets];
                    }
                });
            });
        };
        MediaService_1.prototype.cleanupOrphanedAssets = function () {
            return __awaiter(this, void 0, void 0, function () {
                var tourAssets, count, _i, tourAssets_1, asset, tour, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.log('Starting scheduled cleanup of orphaned MediaAsset records...');
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 8, , 9]);
                            return [4 /*yield*/, this.prisma.mediaAsset.findMany({
                                    where: {
                                        entityType: client_1.MediaEntityType.TOUR,
                                        deletedAt: null,
                                        entityId: { not: null },
                                    },
                                })];
                        case 2:
                            tourAssets = _a.sent();
                            count = 0;
                            _i = 0, tourAssets_1 = tourAssets;
                            _a.label = 3;
                        case 3:
                            if (!(_i < tourAssets_1.length)) return [3 /*break*/, 7];
                            asset = tourAssets_1[_i];
                            if (!asset.entityId) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.prisma.tour.findUnique({
                                    where: { id: asset.entityId },
                                })];
                        case 4:
                            tour = _a.sent();
                            if (!!tour) return [3 /*break*/, 6];
                            this.logger.warn("Found orphaned MediaAsset { id: ".concat(asset.id, ", entityId: ").concat(asset.entityId, " }, soft-deleting..."));
                            return [4 /*yield*/, this.deleteAsset(asset.id)];
                        case 5:
                            _a.sent();
                            count++;
                            _a.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 3];
                        case 7:
                            this.logger.log("Completed scheduled cleanup. Orphaned assets removed: ".concat(count));
                            return [3 /*break*/, 9];
                        case 8:
                            error_2 = _a.sent();
                            this.logger.error("Error during scheduled cleanup of orphaned assets: ".concat(error_2.message), error_2.stack);
                            return [3 /*break*/, 9];
                        case 9: return [2 /*return*/];
                    }
                });
            });
        };
        return MediaService_1;
    }());
    __setFunctionName(_classThis, "MediaService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _cleanupOrphanedAssets_decorators = [(0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT)];
        __esDecorate(_classThis, null, _cleanupOrphanedAssets_decorators, { kind: "method", name: "cleanupOrphanedAssets", static: false, private: false, access: { has: function (obj) { return "cleanupOrphanedAssets" in obj; }, get: function (obj) { return obj.cleanupOrphanedAssets; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MediaService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MediaService = _classThis;
}();
exports.MediaService = MediaService;
