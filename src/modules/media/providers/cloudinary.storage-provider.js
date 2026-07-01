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
exports.CloudinaryStorageProvider = void 0;
var common_1 = require("@nestjs/common");
var cloudinary_1 = require("cloudinary");
var CloudinaryStorageProvider = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var CloudinaryStorageProvider = _classThis = /** @class */ (function () {
        function CloudinaryStorageProvider_1(configService) {
            this.configService = configService;
            this.logger = new common_1.Logger(CloudinaryStorageProvider.name);
            var cloudName = this.configService.get('storage.cloudinaryCloudName');
            var apiKey = this.configService.get('storage.cloudinaryApiKey');
            var apiSecret = this.configService.get('storage.cloudinaryApiSecret');
            cloudinary_1.v2.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
            });
        }
        CloudinaryStorageProvider_1.prototype.upload = function (file, options) {
            return __awaiter(this, void 0, void 0, function () {
                var start, folderPath, tags;
                var _this = this;
                var _a, _b;
                return __generator(this, function (_c) {
                    start = Date.now();
                    folderPath = "".concat(options.folder, "/").concat(options.entityType.toLowerCase(), "/").concat((_a = options.entityId) !== null && _a !== void 0 ? _a : 'general');
                    tags = [
                        'dunas-travel',
                        options.entityType,
                        (_b = options.entityId) !== null && _b !== void 0 ? _b : 'general',
                    ];
                    this.logger.debug("Upload SDK call started { folder: ".concat(folderPath, ", eager count: ").concat(options.eager.length, " }"));
                    return [2 /*return*/, new Promise(function (resolve) {
                            var uploadOptions = {
                                resource_type: 'image',
                                folder: folderPath,
                                use_filename: false,
                                unique_filename: true,
                                overwrite: false,
                                eager: options.eager,
                                eager_async: false,
                                tags: tags,
                                context: options.altText ? "alt=".concat(options.altText) : undefined,
                            };
                            var callback = function (error, result) {
                                var duration_ms = Date.now() - start;
                                if (error) {
                                    _this.logger.error("SDK error { operation: 'upload', errorCode: ".concat(error.http_code || 'UNKNOWN', ", message: '").concat(error.message, "' }"));
                                    return resolve({
                                        success: false,
                                        publicId: '',
                                        url: '',
                                        secureUrl: '',
                                        format: '',
                                        bytes: 0,
                                        width: null,
                                        height: null,
                                        error: error.message,
                                    });
                                }
                                if (!result) {
                                    _this.logger.error("SDK error { operation: 'upload', errorCode: 'UNKNOWN', message: 'No result returned from Cloudinary' }");
                                    return resolve({
                                        success: false,
                                        publicId: '',
                                        url: '',
                                        secureUrl: '',
                                        format: '',
                                        bytes: 0,
                                        width: null,
                                        height: null,
                                        error: 'Unknown error occurred during upload',
                                    });
                                }
                                _this.logger.debug("Upload SDK call completed { publicId: ".concat(result.public_id, ", duration_ms: ").concat(duration_ms, " }"));
                                var finalUrl = result.url;
                                var finalSecureUrl = result.secure_url;
                                if (result.eager && result.eager.length > 0) {
                                    finalUrl = result.eager[0].url;
                                    finalSecureUrl = result.eager[0].secure_url;
                                }
                                resolve({
                                    success: true,
                                    publicId: result.public_id,
                                    url: finalUrl,
                                    secureUrl: finalSecureUrl,
                                    format: result.format,
                                    bytes: result.bytes,
                                    width: result.width || null,
                                    height: result.height || null,
                                    error: null,
                                });
                            };
                            if (file.path) {
                                cloudinary_1.v2.uploader.upload(file.path, uploadOptions, callback);
                            }
                            else if (file.buffer) {
                                var uploadStream = cloudinary_1.v2.uploader.upload_stream(uploadOptions, callback);
                                uploadStream.end(file.buffer);
                            }
                            else {
                                resolve({
                                    success: false,
                                    publicId: '',
                                    url: '',
                                    secureUrl: '',
                                    format: '',
                                    bytes: 0,
                                    width: null,
                                    height: null,
                                    error: 'No buffer or path provided',
                                });
                            }
                        })];
                });
            });
        };
        CloudinaryStorageProvider_1.prototype.delete = function (publicId) {
            return __awaiter(this, void 0, void 0, function () {
                var start, result, duration_ms, error_1, duration_ms;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            start = Date.now();
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, cloudinary_1.v2.uploader.destroy(publicId, {
                                    resource_type: 'image',
                                })];
                        case 2:
                            result = _a.sent();
                            duration_ms = Date.now() - start;
                            if (result.result !== 'ok' && result.result !== 'not found') {
                                this.logger.error("SDK error { operation: 'delete', errorCode: 'UNKNOWN', message: '".concat(result.result, "' }"));
                                throw new Error("Failed to delete asset from Cloudinary: ".concat(result.result));
                            }
                            this.logger.debug("Delete SDK call completed { publicId: ".concat(publicId, ", duration_ms: ").concat(duration_ms, " }"));
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            duration_ms = Date.now() - start;
                            this.logger.error("SDK error { operation: 'delete', errorCode: ".concat(error_1.http_code || 'UNKNOWN', ", message: '").concat(error_1.message, "' }"));
                            throw error_1;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        CloudinaryStorageProvider_1.prototype.getDeliveryUrl = function (publicId, transformOptions) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, cloudinary_1.v2.url(publicId, transformOptions)];
                });
            });
        };
        return CloudinaryStorageProvider_1;
    }());
    __setFunctionName(_classThis, "CloudinaryStorageProvider");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CloudinaryStorageProvider = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CloudinaryStorageProvider = _classThis;
}();
exports.CloudinaryStorageProvider = CloudinaryStorageProvider;
