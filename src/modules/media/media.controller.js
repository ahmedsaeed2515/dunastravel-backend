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
exports.MediaPublicController = exports.MediaAdminController = void 0;
var common_1 = require("@nestjs/common");
var swagger_1 = require("@nestjs/swagger");
var platform_express_1 = require("@nestjs/platform-express");
var multer_1 = require("multer");
var os = __importStar(require("os"));
var path_1 = require("path");
var jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
var roles_guard_1 = require("../../common/guards/roles.guard");
var roles_decorator_1 = require("../../common/decorators/roles.decorator");
var media_asset_response_dto_1 = require("./dto/media-asset-response.dto");
var delete_media_response_dto_1 = require("./dto/delete-media-response.dto");
var client_1 = require("@prisma/client");
var MediaAdminController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Admin — Media'), (0, common_1.Controller)('admin/media')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _upload_decorators;
    var _deleteAsset_decorators;
    var _listAssets_decorators;
    var MediaAdminController = _classThis = /** @class */ (function () {
        function MediaAdminController_1(mediaService) {
            this.mediaService = (__runInitializers(this, _instanceExtraInitializers), mediaService);
        }
        MediaAdminController_1.prototype.upload = function (file, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var asset;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.mediaService.uploadAsset(file, dto, user.id)];
                        case 1:
                            asset = _a.sent();
                            return [2 /*return*/, media_asset_response_dto_1.MediaAssetResponseDto.fromPrisma(asset)];
                    }
                });
            });
        };
        MediaAdminController_1.prototype.deleteAsset = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.mediaService.deleteAsset(id)];
                });
            });
        };
        MediaAdminController_1.prototype.listAssets = function (query) {
            return __awaiter(this, void 0, void 0, function () {
                var result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.mediaService.listAssets(query)];
                        case 1:
                            result = _a.sent();
                            return [2 /*return*/, {
                                    data: result.data.map(function (asset) {
                                        return media_asset_response_dto_1.MediaAssetResponseDto.fromPrisma(asset);
                                    }),
                                    meta: result.meta,
                                }];
                    }
                });
            });
        };
        return MediaAdminController_1;
    }());
    __setFunctionName(_classThis, "MediaAdminController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _upload_decorators = [(0, common_1.Post)('upload'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)('ADMIN'), (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
                storage: (0, multer_1.diskStorage)({
                    destination: os.tmpdir(),
                    filename: function (req, file, cb) {
                        var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                        cb(null, file.fieldname + '-' + uniqueSuffix + (0, path_1.extname)(file.originalname));
                    },
                }),
                limits: {
                    fileSize: 10485760, // Checked dynamically in pipe if we wanted, but multer does hard limit here
                },
                fileFilter: function (req, file, cb) {
                    var allowed = ['image/jpeg', 'image/png', 'image/webp'];
                    if (!allowed.includes(file.mimetype)) {
                        return cb(new common_1.BadRequestException("Invalid file type. Allowed: ".concat(allowed.join(', '))), false);
                    }
                    cb(null, true);
                },
            })), (0, swagger_1.ApiOperation)({ summary: 'Upload a media asset' }), (0, swagger_1.ApiConsumes)('multipart/form-data'), (0, swagger_1.ApiBody)({
                schema: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', format: 'binary' },
                        entityType: { type: 'string', enum: Object.values(client_1.MediaEntityType) },
                        entityId: { type: 'string', format: 'uuid', nullable: true },
                        altText: { type: 'string', maxLength: 255, nullable: true },
                    },
                },
            }), (0, swagger_1.ApiCreatedResponse)({ type: media_asset_response_dto_1.MediaAssetResponseDto }), (0, swagger_1.ApiBadRequestResponse)(), (0, swagger_1.ApiUnauthorizedResponse)(), (0, swagger_1.ApiForbiddenResponse)(), (0, swagger_1.ApiBadGatewayResponse)()];
        _deleteAsset_decorators = [(0, common_1.Delete)(':id'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)('ADMIN'), (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a media asset' }), (0, swagger_1.ApiParam)({ name: 'id', type: 'string', format: 'uuid' }), (0, swagger_1.ApiOkResponse)({ type: delete_media_response_dto_1.DeleteMediaResponseDto }), (0, swagger_1.ApiNotFoundResponse)(), (0, swagger_1.ApiUnauthorizedResponse)(), (0, swagger_1.ApiForbiddenResponse)()];
        _listAssets_decorators = [(0, common_1.Get)(), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), (0, roles_decorator_1.Roles)('ADMIN'), (0, swagger_1.ApiOperation)({ summary: 'List media assets (admin, paginated)' }), (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }), (0, swagger_1.ApiQuery)({ name: 'entityType', required: false, enum: client_1.MediaEntityType }), (0, swagger_1.ApiQuery)({ name: 'entityId', required: false, type: String }), (0, swagger_1.ApiQuery)({ name: 'includeDeleted', required: false, type: Boolean }), (0, swagger_1.ApiOkResponse)({
                schema: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/MediaAssetResponseDto' },
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                total: { type: 'number' },
                                page: { type: 'number' },
                                limit: { type: 'number' },
                                totalPages: { type: 'number' },
                            },
                        },
                    },
                },
            }), (0, swagger_1.ApiUnauthorizedResponse)(), (0, swagger_1.ApiForbiddenResponse)()];
        __esDecorate(_classThis, null, _upload_decorators, { kind: "method", name: "upload", static: false, private: false, access: { has: function (obj) { return "upload" in obj; }, get: function (obj) { return obj.upload; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _deleteAsset_decorators, { kind: "method", name: "deleteAsset", static: false, private: false, access: { has: function (obj) { return "deleteAsset" in obj; }, get: function (obj) { return obj.deleteAsset; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listAssets_decorators, { kind: "method", name: "listAssets", static: false, private: false, access: { has: function (obj) { return "listAssets" in obj; }, get: function (obj) { return obj.listAssets; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MediaAdminController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MediaAdminController = _classThis;
}();
exports.MediaAdminController = MediaAdminController;
var MediaPublicController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Media'), (0, common_1.Controller)('media')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _getAssetsByTourId_decorators;
    var MediaPublicController = _classThis = /** @class */ (function () {
        function MediaPublicController_1(mediaService) {
            this.mediaService = (__runInitializers(this, _instanceExtraInitializers), mediaService);
        }
        MediaPublicController_1.prototype.getAssetsByTourId = function (tourId) {
            return __awaiter(this, void 0, void 0, function () {
                var assets;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.mediaService.getAssetsByTourId(tourId)];
                        case 1:
                            assets = _a.sent();
                            return [2 /*return*/, assets.map(function (asset) {
                                    return media_asset_response_dto_1.MediaAssetResponseDto.fromPrisma(asset);
                                })];
                    }
                });
            });
        };
        return MediaPublicController_1;
    }());
    __setFunctionName(_classThis, "MediaPublicController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _getAssetsByTourId_decorators = [(0, common_1.Get)('tours/:tourId'), (0, swagger_1.ApiOperation)({ summary: 'Get all active media assets for a tour' }), (0, swagger_1.ApiParam)({ name: 'tourId', type: 'string', format: 'uuid' }), (0, swagger_1.ApiOkResponse)({ type: [media_asset_response_dto_1.MediaAssetResponseDto] }), (0, swagger_1.ApiBadRequestResponse)()];
        __esDecorate(_classThis, null, _getAssetsByTourId_decorators, { kind: "method", name: "getAssetsByTourId", static: false, private: false, access: { has: function (obj) { return "getAssetsByTourId" in obj; }, get: function (obj) { return obj.getAssetsByTourId; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        MediaPublicController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return MediaPublicController = _classThis;
}();
exports.MediaPublicController = MediaPublicController;
