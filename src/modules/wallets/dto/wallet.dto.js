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
exports.WalletTransactionQueryFilters = exports.WalletQueryFilters = exports.CreateWalletTransactionDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var client_1 = require("@prisma/client");
var CreateWalletTransactionDto = function () {
    var _a;
    var _ownerType_decorators;
    var _ownerType_initializers = [];
    var _ownerType_extraInitializers = [];
    var _ownerId_decorators;
    var _ownerId_initializers = [];
    var _ownerId_extraInitializers = [];
    var _amount_decorators;
    var _amount_initializers = [];
    var _amount_extraInitializers = [];
    var _type_decorators;
    var _type_initializers = [];
    var _type_extraInitializers = [];
    var _referenceType_decorators;
    var _referenceType_initializers = [];
    var _referenceType_extraInitializers = [];
    var _referenceId_decorators;
    var _referenceId_initializers = [];
    var _referenceId_extraInitializers = [];
    var _description_decorators;
    var _description_initializers = [];
    var _description_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateWalletTransactionDto() {
                this.ownerType = __runInitializers(this, _ownerType_initializers, void 0);
                this.ownerId = (__runInitializers(this, _ownerType_extraInitializers), __runInitializers(this, _ownerId_initializers, void 0));
                this.amount = (__runInitializers(this, _ownerId_extraInitializers), __runInitializers(this, _amount_initializers, void 0));
                this.type = (__runInitializers(this, _amount_extraInitializers), __runInitializers(this, _type_initializers, void 0));
                this.referenceType = (__runInitializers(this, _type_extraInitializers), __runInitializers(this, _referenceType_initializers, void 0));
                this.referenceId = (__runInitializers(this, _referenceType_extraInitializers), __runInitializers(this, _referenceId_initializers, void 0));
                this.description = (__runInitializers(this, _referenceId_extraInitializers), __runInitializers(this, _description_initializers, void 0));
                this.status = (__runInitializers(this, _description_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                __runInitializers(this, _status_extraInitializers);
            }
            return CreateWalletTransactionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _ownerType_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.WalletOwnerType }), (0, class_validator_1.IsEnum)(client_1.WalletOwnerType)];
            _ownerId_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _amount_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            _type_decorators = [(0, swagger_1.ApiProperty)({ enum: client_1.WalletTransactionType }), (0, class_validator_1.IsEnum)(client_1.WalletTransactionType)];
            _referenceType_decorators = [(0, swagger_1.ApiProperty)(), (0, class_validator_1.IsString)()];
            _referenceId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _description_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.WalletTransactionStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.WalletTransactionStatus)];
            __esDecorate(null, null, _ownerType_decorators, { kind: "field", name: "ownerType", static: false, private: false, access: { has: function (obj) { return "ownerType" in obj; }, get: function (obj) { return obj.ownerType; }, set: function (obj, value) { obj.ownerType = value; } }, metadata: _metadata }, _ownerType_initializers, _ownerType_extraInitializers);
            __esDecorate(null, null, _ownerId_decorators, { kind: "field", name: "ownerId", static: false, private: false, access: { has: function (obj) { return "ownerId" in obj; }, get: function (obj) { return obj.ownerId; }, set: function (obj, value) { obj.ownerId = value; } }, metadata: _metadata }, _ownerId_initializers, _ownerId_extraInitializers);
            __esDecorate(null, null, _amount_decorators, { kind: "field", name: "amount", static: false, private: false, access: { has: function (obj) { return "amount" in obj; }, get: function (obj) { return obj.amount; }, set: function (obj, value) { obj.amount = value; } }, metadata: _metadata }, _amount_initializers, _amount_extraInitializers);
            __esDecorate(null, null, _type_decorators, { kind: "field", name: "type", static: false, private: false, access: { has: function (obj) { return "type" in obj; }, get: function (obj) { return obj.type; }, set: function (obj, value) { obj.type = value; } }, metadata: _metadata }, _type_initializers, _type_extraInitializers);
            __esDecorate(null, null, _referenceType_decorators, { kind: "field", name: "referenceType", static: false, private: false, access: { has: function (obj) { return "referenceType" in obj; }, get: function (obj) { return obj.referenceType; }, set: function (obj, value) { obj.referenceType = value; } }, metadata: _metadata }, _referenceType_initializers, _referenceType_extraInitializers);
            __esDecorate(null, null, _referenceId_decorators, { kind: "field", name: "referenceId", static: false, private: false, access: { has: function (obj) { return "referenceId" in obj; }, get: function (obj) { return obj.referenceId; }, set: function (obj, value) { obj.referenceId = value; } }, metadata: _metadata }, _referenceId_initializers, _referenceId_extraInitializers);
            __esDecorate(null, null, _description_decorators, { kind: "field", name: "description", static: false, private: false, access: { has: function (obj) { return "description" in obj; }, get: function (obj) { return obj.description; }, set: function (obj, value) { obj.description = value; } }, metadata: _metadata }, _description_initializers, _description_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateWalletTransactionDto = CreateWalletTransactionDto;
var WalletQueryFilters = function () {
    var _a;
    var _ownerType_decorators;
    var _ownerType_initializers = [];
    var _ownerType_extraInitializers = [];
    var _ownerId_decorators;
    var _ownerId_initializers = [];
    var _ownerId_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    return _a = /** @class */ (function () {
            function WalletQueryFilters() {
                this.ownerType = __runInitializers(this, _ownerType_initializers, void 0);
                this.ownerId = (__runInitializers(this, _ownerType_extraInitializers), __runInitializers(this, _ownerId_initializers, void 0));
                this.status = (__runInitializers(this, _ownerId_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                __runInitializers(this, _status_extraInitializers);
            }
            return WalletQueryFilters;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _ownerType_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.WalletOwnerType)];
            _ownerId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _ownerType_decorators, { kind: "field", name: "ownerType", static: false, private: false, access: { has: function (obj) { return "ownerType" in obj; }, get: function (obj) { return obj.ownerType; }, set: function (obj, value) { obj.ownerType = value; } }, metadata: _metadata }, _ownerType_initializers, _ownerType_extraInitializers);
            __esDecorate(null, null, _ownerId_decorators, { kind: "field", name: "ownerId", static: false, private: false, access: { has: function (obj) { return "ownerId" in obj; }, get: function (obj) { return obj.ownerId; }, set: function (obj, value) { obj.ownerId = value; } }, metadata: _metadata }, _ownerId_initializers, _ownerId_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.WalletQueryFilters = WalletQueryFilters;
var WalletTransactionQueryFilters = function () {
    var _a;
    var _walletId_decorators;
    var _walletId_initializers = [];
    var _walletId_extraInitializers = [];
    var _referenceType_decorators;
    var _referenceType_initializers = [];
    var _referenceType_extraInitializers = [];
    return _a = /** @class */ (function () {
            function WalletTransactionQueryFilters() {
                this.walletId = __runInitializers(this, _walletId_initializers, void 0);
                this.referenceType = (__runInitializers(this, _walletId_extraInitializers), __runInitializers(this, _referenceType_initializers, void 0));
                __runInitializers(this, _referenceType_extraInitializers);
            }
            return WalletTransactionQueryFilters;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _walletId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsUUID)()];
            _referenceType_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _walletId_decorators, { kind: "field", name: "walletId", static: false, private: false, access: { has: function (obj) { return "walletId" in obj; }, get: function (obj) { return obj.walletId; }, set: function (obj, value) { obj.walletId = value; } }, metadata: _metadata }, _walletId_initializers, _walletId_extraInitializers);
            __esDecorate(null, null, _referenceType_decorators, { kind: "field", name: "referenceType", static: false, private: false, access: { has: function (obj) { return "referenceType" in obj; }, get: function (obj) { return obj.referenceType; }, set: function (obj, value) { obj.referenceType = value; } }, metadata: _metadata }, _referenceType_initializers, _referenceType_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.WalletTransactionQueryFilters = WalletTransactionQueryFilters;
