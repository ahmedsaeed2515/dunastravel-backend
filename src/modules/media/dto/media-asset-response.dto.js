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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaAssetResponseDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var MediaAssetResponseDto = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _publicId_decorators;
    var _publicId_initializers = [];
    var _publicId_extraInitializers = [];
    var _url_decorators;
    var _url_initializers = [];
    var _url_extraInitializers = [];
    var _secureUrl_decorators;
    var _secureUrl_initializers = [];
    var _secureUrl_extraInitializers = [];
    var _providerName_decorators;
    var _providerName_initializers = [];
    var _providerName_extraInitializers = [];
    var _format_decorators;
    var _format_initializers = [];
    var _format_extraInitializers = [];
    var _mimeType_decorators;
    var _mimeType_initializers = [];
    var _mimeType_extraInitializers = [];
    var _bytes_decorators;
    var _bytes_initializers = [];
    var _bytes_extraInitializers = [];
    var _width_decorators;
    var _width_initializers = [];
    var _width_extraInitializers = [];
    var _height_decorators;
    var _height_initializers = [];
    var _height_extraInitializers = [];
    var _entityType_decorators;
    var _entityType_initializers = [];
    var _entityType_extraInitializers = [];
    var _entityId_decorators;
    var _entityId_initializers = [];
    var _entityId_extraInitializers = [];
    var _provenance_decorators;
    var _provenance_initializers = [];
    var _provenance_extraInitializers = [];
    var _altText_decorators;
    var _altText_initializers = [];
    var _altText_extraInitializers = [];
    var _uploadedBy_decorators;
    var _uploadedBy_initializers = [];
    var _uploadedBy_extraInitializers = [];
    var _deletedAt_decorators;
    var _deletedAt_initializers = [];
    var _deletedAt_extraInitializers = [];
    var _createdAt_decorators;
    var _createdAt_initializers = [];
    var _createdAt_extraInitializers = [];
    var _updatedAt_decorators;
    var _updatedAt_initializers = [];
    var _updatedAt_extraInitializers = [];
    return _a = /** @class */ (function () {
            function MediaAssetResponseDto() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.publicId = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _publicId_initializers, void 0));
                this.url = (__runInitializers(this, _publicId_extraInitializers), __runInitializers(this, _url_initializers, void 0));
                this.secureUrl = (__runInitializers(this, _url_extraInitializers), __runInitializers(this, _secureUrl_initializers, void 0));
                this.providerName = (__runInitializers(this, _secureUrl_extraInitializers), __runInitializers(this, _providerName_initializers, void 0));
                this.format = (__runInitializers(this, _providerName_extraInitializers), __runInitializers(this, _format_initializers, void 0));
                this.mimeType = (__runInitializers(this, _format_extraInitializers), __runInitializers(this, _mimeType_initializers, void 0));
                this.bytes = (__runInitializers(this, _mimeType_extraInitializers), __runInitializers(this, _bytes_initializers, void 0));
                this.width = (__runInitializers(this, _bytes_extraInitializers), __runInitializers(this, _width_initializers, void 0));
                this.height = (__runInitializers(this, _width_extraInitializers), __runInitializers(this, _height_initializers, void 0));
                this.entityType = (__runInitializers(this, _height_extraInitializers), __runInitializers(this, _entityType_initializers, void 0));
                this.entityId = (__runInitializers(this, _entityType_extraInitializers), __runInitializers(this, _entityId_initializers, void 0));
                this.provenance = (__runInitializers(this, _entityId_extraInitializers), __runInitializers(this, _provenance_initializers, void 0));
                this.altText = (__runInitializers(this, _provenance_extraInitializers), __runInitializers(this, _altText_initializers, void 0));
                this.uploadedBy = (__runInitializers(this, _altText_extraInitializers), __runInitializers(this, _uploadedBy_initializers, void 0));
                this.deletedAt = (__runInitializers(this, _uploadedBy_extraInitializers), __runInitializers(this, _deletedAt_initializers, void 0));
                this.createdAt = (__runInitializers(this, _deletedAt_extraInitializers), __runInitializers(this, _createdAt_initializers, void 0));
                this.updatedAt = (__runInitializers(this, _createdAt_extraInitializers), __runInitializers(this, _updatedAt_initializers, void 0));
                __runInitializers(this, _updatedAt_extraInitializers);
            }
            MediaAssetResponseDto.fromPrisma = function (asset) {
                var dto = new _a();
                dto.id = asset.id;
                dto.publicId = asset.publicId;
                dto.url = asset.url;
                dto.secureUrl = asset.secureUrl;
                dto.providerName = asset.providerName;
                dto.format = asset.format;
                dto.mimeType = asset.mimeType;
                dto.bytes = asset.bytes;
                dto.width = asset.width;
                dto.height = asset.height;
                dto.entityType = asset.entityType;
                dto.entityId = asset.entityId;
                dto.provenance = asset.provenance;
                dto.altText = asset.altText;
                dto.uploadedBy = asset.uploadedBy;
                dto.deletedAt = asset.deletedAt;
                dto.createdAt = asset.createdAt;
                dto.updatedAt = asset.updatedAt;
                return dto;
            };
            return MediaAssetResponseDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiProperty)()];
            _publicId_decorators = [(0, swagger_1.ApiProperty)()];
            _url_decorators = [(0, swagger_1.ApiProperty)()];
            _secureUrl_decorators = [(0, swagger_1.ApiProperty)()];
            _providerName_decorators = [(0, swagger_1.ApiProperty)()];
            _format_decorators = [(0, swagger_1.ApiProperty)()];
            _mimeType_decorators = [(0, swagger_1.ApiProperty)()];
            _bytes_decorators = [(0, swagger_1.ApiProperty)()];
            _width_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _height_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _entityType_decorators = [(0, swagger_1.ApiProperty)()];
            _entityId_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _provenance_decorators = [(0, swagger_1.ApiProperty)()];
            _altText_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _uploadedBy_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _deletedAt_decorators = [(0, swagger_1.ApiPropertyOptional)()];
            _createdAt_decorators = [(0, swagger_1.ApiProperty)()];
            _updatedAt_decorators = [(0, swagger_1.ApiProperty)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _publicId_decorators, { kind: "field", name: "publicId", static: false, private: false, access: { has: function (obj) { return "publicId" in obj; }, get: function (obj) { return obj.publicId; }, set: function (obj, value) { obj.publicId = value; } }, metadata: _metadata }, _publicId_initializers, _publicId_extraInitializers);
            __esDecorate(null, null, _url_decorators, { kind: "field", name: "url", static: false, private: false, access: { has: function (obj) { return "url" in obj; }, get: function (obj) { return obj.url; }, set: function (obj, value) { obj.url = value; } }, metadata: _metadata }, _url_initializers, _url_extraInitializers);
            __esDecorate(null, null, _secureUrl_decorators, { kind: "field", name: "secureUrl", static: false, private: false, access: { has: function (obj) { return "secureUrl" in obj; }, get: function (obj) { return obj.secureUrl; }, set: function (obj, value) { obj.secureUrl = value; } }, metadata: _metadata }, _secureUrl_initializers, _secureUrl_extraInitializers);
            __esDecorate(null, null, _providerName_decorators, { kind: "field", name: "providerName", static: false, private: false, access: { has: function (obj) { return "providerName" in obj; }, get: function (obj) { return obj.providerName; }, set: function (obj, value) { obj.providerName = value; } }, metadata: _metadata }, _providerName_initializers, _providerName_extraInitializers);
            __esDecorate(null, null, _format_decorators, { kind: "field", name: "format", static: false, private: false, access: { has: function (obj) { return "format" in obj; }, get: function (obj) { return obj.format; }, set: function (obj, value) { obj.format = value; } }, metadata: _metadata }, _format_initializers, _format_extraInitializers);
            __esDecorate(null, null, _mimeType_decorators, { kind: "field", name: "mimeType", static: false, private: false, access: { has: function (obj) { return "mimeType" in obj; }, get: function (obj) { return obj.mimeType; }, set: function (obj, value) { obj.mimeType = value; } }, metadata: _metadata }, _mimeType_initializers, _mimeType_extraInitializers);
            __esDecorate(null, null, _bytes_decorators, { kind: "field", name: "bytes", static: false, private: false, access: { has: function (obj) { return "bytes" in obj; }, get: function (obj) { return obj.bytes; }, set: function (obj, value) { obj.bytes = value; } }, metadata: _metadata }, _bytes_initializers, _bytes_extraInitializers);
            __esDecorate(null, null, _width_decorators, { kind: "field", name: "width", static: false, private: false, access: { has: function (obj) { return "width" in obj; }, get: function (obj) { return obj.width; }, set: function (obj, value) { obj.width = value; } }, metadata: _metadata }, _width_initializers, _width_extraInitializers);
            __esDecorate(null, null, _height_decorators, { kind: "field", name: "height", static: false, private: false, access: { has: function (obj) { return "height" in obj; }, get: function (obj) { return obj.height; }, set: function (obj, value) { obj.height = value; } }, metadata: _metadata }, _height_initializers, _height_extraInitializers);
            __esDecorate(null, null, _entityType_decorators, { kind: "field", name: "entityType", static: false, private: false, access: { has: function (obj) { return "entityType" in obj; }, get: function (obj) { return obj.entityType; }, set: function (obj, value) { obj.entityType = value; } }, metadata: _metadata }, _entityType_initializers, _entityType_extraInitializers);
            __esDecorate(null, null, _entityId_decorators, { kind: "field", name: "entityId", static: false, private: false, access: { has: function (obj) { return "entityId" in obj; }, get: function (obj) { return obj.entityId; }, set: function (obj, value) { obj.entityId = value; } }, metadata: _metadata }, _entityId_initializers, _entityId_extraInitializers);
            __esDecorate(null, null, _provenance_decorators, { kind: "field", name: "provenance", static: false, private: false, access: { has: function (obj) { return "provenance" in obj; }, get: function (obj) { return obj.provenance; }, set: function (obj, value) { obj.provenance = value; } }, metadata: _metadata }, _provenance_initializers, _provenance_extraInitializers);
            __esDecorate(null, null, _altText_decorators, { kind: "field", name: "altText", static: false, private: false, access: { has: function (obj) { return "altText" in obj; }, get: function (obj) { return obj.altText; }, set: function (obj, value) { obj.altText = value; } }, metadata: _metadata }, _altText_initializers, _altText_extraInitializers);
            __esDecorate(null, null, _uploadedBy_decorators, { kind: "field", name: "uploadedBy", static: false, private: false, access: { has: function (obj) { return "uploadedBy" in obj; }, get: function (obj) { return obj.uploadedBy; }, set: function (obj, value) { obj.uploadedBy = value; } }, metadata: _metadata }, _uploadedBy_initializers, _uploadedBy_extraInitializers);
            __esDecorate(null, null, _deletedAt_decorators, { kind: "field", name: "deletedAt", static: false, private: false, access: { has: function (obj) { return "deletedAt" in obj; }, get: function (obj) { return obj.deletedAt; }, set: function (obj, value) { obj.deletedAt = value; } }, metadata: _metadata }, _deletedAt_initializers, _deletedAt_extraInitializers);
            __esDecorate(null, null, _createdAt_decorators, { kind: "field", name: "createdAt", static: false, private: false, access: { has: function (obj) { return "createdAt" in obj; }, get: function (obj) { return obj.createdAt; }, set: function (obj, value) { obj.createdAt = value; } }, metadata: _metadata }, _createdAt_initializers, _createdAt_extraInitializers);
            __esDecorate(null, null, _updatedAt_decorators, { kind: "field", name: "updatedAt", static: false, private: false, access: { has: function (obj) { return "updatedAt" in obj; }, get: function (obj) { return obj.updatedAt; }, set: function (obj, value) { obj.updatedAt = value; } }, metadata: _metadata }, _updatedAt_initializers, _updatedAt_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.MediaAssetResponseDto = MediaAssetResponseDto;
