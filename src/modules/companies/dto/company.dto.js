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
exports.BulkUpdateCompaniesDto = exports.CompanyQueryFilters = exports.UpdateCompanyDto = exports.CreateCompanyDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var client_1 = require("@prisma/client");
var class_transformer_1 = require("class-transformer");
var CreateCompanyDto = function () {
    var _a;
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _companyType_decorators;
    var _companyType_initializers = [];
    var _companyType_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _website_decorators;
    var _website_initializers = [];
    var _website_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    var _primaryContact_decorators;
    var _primaryContact_initializers = [];
    var _primaryContact_extraInitializers = [];
    var _commissionRate_decorators;
    var _commissionRate_initializers = [];
    var _commissionRate_extraInitializers = [];
    var _paymentTerms_decorators;
    var _paymentTerms_initializers = [];
    var _paymentTerms_extraInitializers = [];
    var _contractStartDate_decorators;
    var _contractStartDate_initializers = [];
    var _contractStartDate_extraInitializers = [];
    var _contractEndDate_decorators;
    var _contractEndDate_initializers = [];
    var _contractEndDate_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _segments_decorators;
    var _segments_initializers = [];
    var _segments_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateCompanyDto() {
                this.name = __runInitializers(this, _name_initializers, void 0);
                this.companyType = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _companyType_initializers, void 0));
                this.email = (__runInitializers(this, _companyType_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.phone = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                this.website = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _website_initializers, void 0));
                this.address = (__runInitializers(this, _website_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                this.primaryContact = (__runInitializers(this, _address_extraInitializers), __runInitializers(this, _primaryContact_initializers, void 0));
                this.commissionRate = (__runInitializers(this, _primaryContact_extraInitializers), __runInitializers(this, _commissionRate_initializers, void 0));
                this.paymentTerms = (__runInitializers(this, _commissionRate_extraInitializers), __runInitializers(this, _paymentTerms_initializers, void 0));
                this.contractStartDate = (__runInitializers(this, _paymentTerms_extraInitializers), __runInitializers(this, _contractStartDate_initializers, void 0));
                this.contractEndDate = (__runInitializers(this, _contractStartDate_extraInitializers), __runInitializers(this, _contractEndDate_initializers, void 0));
                this.tags = (__runInitializers(this, _contractEndDate_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.segments = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _segments_initializers, void 0));
                __runInitializers(this, _segments_extraInitializers);
            }
            return CreateCompanyDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _name_decorators = [(0, swagger_1.ApiProperty)({ example: 'Acme Luxury Travel' }), (0, class_validator_1.IsString)()];
            _companyType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyType, example: client_1.CompanyType.AGENCY }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyType)];
            _email_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'contact@acmetravel.com' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEmail)()];
            _phone_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '+1-555-0198' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _website_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'https://acmetravel.com' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: { street: '123 Elite Ave', city: 'London' } }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _primaryContact_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: {
                        name: 'John Doe',
                        role: 'Director',
                        email: 'john@acmetravel.com',
                    },
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _commissionRate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 10.5 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseFloat(value);
                })];
            _paymentTerms_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'NET_30' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _contractStartDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2026-01-01T00:00:00.000Z' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _contractEndDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2027-01-01T00:00:00.000Z' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['VIP', 'Europe'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _segments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['Corporate Partner'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _companyType_decorators, { kind: "field", name: "companyType", static: false, private: false, access: { has: function (obj) { return "companyType" in obj; }, get: function (obj) { return obj.companyType; }, set: function (obj, value) { obj.companyType = value; } }, metadata: _metadata }, _companyType_initializers, _companyType_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _website_decorators, { kind: "field", name: "website", static: false, private: false, access: { has: function (obj) { return "website" in obj; }, get: function (obj) { return obj.website; }, set: function (obj, value) { obj.website = value; } }, metadata: _metadata }, _website_initializers, _website_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            __esDecorate(null, null, _primaryContact_decorators, { kind: "field", name: "primaryContact", static: false, private: false, access: { has: function (obj) { return "primaryContact" in obj; }, get: function (obj) { return obj.primaryContact; }, set: function (obj, value) { obj.primaryContact = value; } }, metadata: _metadata }, _primaryContact_initializers, _primaryContact_extraInitializers);
            __esDecorate(null, null, _commissionRate_decorators, { kind: "field", name: "commissionRate", static: false, private: false, access: { has: function (obj) { return "commissionRate" in obj; }, get: function (obj) { return obj.commissionRate; }, set: function (obj, value) { obj.commissionRate = value; } }, metadata: _metadata }, _commissionRate_initializers, _commissionRate_extraInitializers);
            __esDecorate(null, null, _paymentTerms_decorators, { kind: "field", name: "paymentTerms", static: false, private: false, access: { has: function (obj) { return "paymentTerms" in obj; }, get: function (obj) { return obj.paymentTerms; }, set: function (obj, value) { obj.paymentTerms = value; } }, metadata: _metadata }, _paymentTerms_initializers, _paymentTerms_extraInitializers);
            __esDecorate(null, null, _contractStartDate_decorators, { kind: "field", name: "contractStartDate", static: false, private: false, access: { has: function (obj) { return "contractStartDate" in obj; }, get: function (obj) { return obj.contractStartDate; }, set: function (obj, value) { obj.contractStartDate = value; } }, metadata: _metadata }, _contractStartDate_initializers, _contractStartDate_extraInitializers);
            __esDecorate(null, null, _contractEndDate_decorators, { kind: "field", name: "contractEndDate", static: false, private: false, access: { has: function (obj) { return "contractEndDate" in obj; }, get: function (obj) { return obj.contractEndDate; }, set: function (obj, value) { obj.contractEndDate = value; } }, metadata: _metadata }, _contractEndDate_initializers, _contractEndDate_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _segments_decorators, { kind: "field", name: "segments", static: false, private: false, access: { has: function (obj) { return "segments" in obj; }, get: function (obj) { return obj.segments; }, set: function (obj, value) { obj.segments = value; } }, metadata: _metadata }, _segments_initializers, _segments_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateCompanyDto = CreateCompanyDto;
var UpdateCompanyDto = function () {
    var _a;
    var _name_decorators;
    var _name_initializers = [];
    var _name_extraInitializers = [];
    var _companyType_decorators;
    var _companyType_initializers = [];
    var _companyType_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _website_decorators;
    var _website_initializers = [];
    var _website_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    var _primaryContact_decorators;
    var _primaryContact_initializers = [];
    var _primaryContact_extraInitializers = [];
    var _commissionRate_decorators;
    var _commissionRate_initializers = [];
    var _commissionRate_extraInitializers = [];
    var _currentBalance_decorators;
    var _currentBalance_initializers = [];
    var _currentBalance_extraInitializers = [];
    var _paymentTerms_decorators;
    var _paymentTerms_initializers = [];
    var _paymentTerms_extraInitializers = [];
    var _contractStartDate_decorators;
    var _contractStartDate_initializers = [];
    var _contractStartDate_extraInitializers = [];
    var _contractEndDate_decorators;
    var _contractEndDate_initializers = [];
    var _contractEndDate_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _segments_decorators;
    var _segments_initializers = [];
    var _segments_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateCompanyDto() {
                this.name = __runInitializers(this, _name_initializers, void 0);
                this.companyType = (__runInitializers(this, _name_extraInitializers), __runInitializers(this, _companyType_initializers, void 0));
                this.status = (__runInitializers(this, _companyType_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.email = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.phone = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                this.website = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _website_initializers, void 0));
                this.address = (__runInitializers(this, _website_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                this.primaryContact = (__runInitializers(this, _address_extraInitializers), __runInitializers(this, _primaryContact_initializers, void 0));
                this.commissionRate = (__runInitializers(this, _primaryContact_extraInitializers), __runInitializers(this, _commissionRate_initializers, void 0));
                this.currentBalance = (__runInitializers(this, _commissionRate_extraInitializers), __runInitializers(this, _currentBalance_initializers, void 0));
                this.paymentTerms = (__runInitializers(this, _currentBalance_extraInitializers), __runInitializers(this, _paymentTerms_initializers, void 0));
                this.contractStartDate = (__runInitializers(this, _paymentTerms_extraInitializers), __runInitializers(this, _contractStartDate_initializers, void 0));
                this.contractEndDate = (__runInitializers(this, _contractStartDate_extraInitializers), __runInitializers(this, _contractEndDate_initializers, void 0));
                this.tags = (__runInitializers(this, _contractEndDate_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.segments = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _segments_initializers, void 0));
                __runInitializers(this, _segments_extraInitializers);
            }
            return UpdateCompanyDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _name_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Acme Luxury Travel' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _companyType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyType, example: client_1.CompanyType.AGENCY }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyType)];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyStatus, example: client_1.CompanyStatus.ACTIVE }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyStatus)];
            _email_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'contact@acmetravel.com' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEmail)()];
            _phone_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '+1-555-0198' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _website_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'https://acmetravel.com' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: { street: '123 Elite Ave', city: 'London' } }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _primaryContact_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: {
                        name: 'John Doe',
                        role: 'Director',
                        email: 'john@acmetravel.com',
                    },
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _commissionRate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 10.5 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseFloat(value);
                })];
            _currentBalance_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 5000.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseFloat(value);
                })];
            _paymentTerms_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'NET_30' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _contractStartDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2026-01-01T00:00:00.000Z' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _contractEndDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2027-01-01T00:00:00.000Z' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['VIP', 'Europe'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _segments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['Corporate Partner'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: function (obj) { return "name" in obj; }, get: function (obj) { return obj.name; }, set: function (obj, value) { obj.name = value; } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
            __esDecorate(null, null, _companyType_decorators, { kind: "field", name: "companyType", static: false, private: false, access: { has: function (obj) { return "companyType" in obj; }, get: function (obj) { return obj.companyType; }, set: function (obj, value) { obj.companyType = value; } }, metadata: _metadata }, _companyType_initializers, _companyType_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _website_decorators, { kind: "field", name: "website", static: false, private: false, access: { has: function (obj) { return "website" in obj; }, get: function (obj) { return obj.website; }, set: function (obj, value) { obj.website = value; } }, metadata: _metadata }, _website_initializers, _website_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            __esDecorate(null, null, _primaryContact_decorators, { kind: "field", name: "primaryContact", static: false, private: false, access: { has: function (obj) { return "primaryContact" in obj; }, get: function (obj) { return obj.primaryContact; }, set: function (obj, value) { obj.primaryContact = value; } }, metadata: _metadata }, _primaryContact_initializers, _primaryContact_extraInitializers);
            __esDecorate(null, null, _commissionRate_decorators, { kind: "field", name: "commissionRate", static: false, private: false, access: { has: function (obj) { return "commissionRate" in obj; }, get: function (obj) { return obj.commissionRate; }, set: function (obj, value) { obj.commissionRate = value; } }, metadata: _metadata }, _commissionRate_initializers, _commissionRate_extraInitializers);
            __esDecorate(null, null, _currentBalance_decorators, { kind: "field", name: "currentBalance", static: false, private: false, access: { has: function (obj) { return "currentBalance" in obj; }, get: function (obj) { return obj.currentBalance; }, set: function (obj, value) { obj.currentBalance = value; } }, metadata: _metadata }, _currentBalance_initializers, _currentBalance_extraInitializers);
            __esDecorate(null, null, _paymentTerms_decorators, { kind: "field", name: "paymentTerms", static: false, private: false, access: { has: function (obj) { return "paymentTerms" in obj; }, get: function (obj) { return obj.paymentTerms; }, set: function (obj, value) { obj.paymentTerms = value; } }, metadata: _metadata }, _paymentTerms_initializers, _paymentTerms_extraInitializers);
            __esDecorate(null, null, _contractStartDate_decorators, { kind: "field", name: "contractStartDate", static: false, private: false, access: { has: function (obj) { return "contractStartDate" in obj; }, get: function (obj) { return obj.contractStartDate; }, set: function (obj, value) { obj.contractStartDate = value; } }, metadata: _metadata }, _contractStartDate_initializers, _contractStartDate_extraInitializers);
            __esDecorate(null, null, _contractEndDate_decorators, { kind: "field", name: "contractEndDate", static: false, private: false, access: { has: function (obj) { return "contractEndDate" in obj; }, get: function (obj) { return obj.contractEndDate; }, set: function (obj, value) { obj.contractEndDate = value; } }, metadata: _metadata }, _contractEndDate_initializers, _contractEndDate_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _segments_decorators, { kind: "field", name: "segments", static: false, private: false, access: { has: function (obj) { return "segments" in obj; }, get: function (obj) { return obj.segments; }, set: function (obj, value) { obj.segments = value; } }, metadata: _metadata }, _segments_initializers, _segments_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateCompanyDto = UpdateCompanyDto;
var CompanyQueryFilters = function () {
    var _a;
    var _page_decorators;
    var _page_initializers = [];
    var _page_extraInitializers = [];
    var _limit_decorators;
    var _limit_initializers = [];
    var _limit_extraInitializers = [];
    var _search_decorators;
    var _search_initializers = [];
    var _search_extraInitializers = [];
    var _companyType_decorators;
    var _companyType_initializers = [];
    var _companyType_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _tag_decorators;
    var _tag_initializers = [];
    var _tag_extraInitializers = [];
    var _segment_decorators;
    var _segment_initializers = [];
    var _segment_extraInitializers = [];
    var _sortBy_decorators;
    var _sortBy_initializers = [];
    var _sortBy_extraInitializers = [];
    var _sortOrder_decorators;
    var _sortOrder_initializers = [];
    var _sortOrder_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CompanyQueryFilters() {
                this.page = __runInitializers(this, _page_initializers, void 0);
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                this.search = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _search_initializers, void 0));
                this.companyType = (__runInitializers(this, _search_extraInitializers), __runInitializers(this, _companyType_initializers, void 0));
                this.status = (__runInitializers(this, _companyType_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.tag = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _tag_initializers, void 0));
                this.segment = (__runInitializers(this, _tag_extraInitializers), __runInitializers(this, _segment_initializers, void 0));
                this.sortBy = (__runInitializers(this, _segment_extraInitializers), __runInitializers(this, _sortBy_initializers, void 0));
                this.sortOrder = (__runInitializers(this, _sortBy_extraInitializers), __runInitializers(this, _sortOrder_initializers, void 0));
                __runInitializers(this, _sortOrder_extraInitializers);
            }
            return CompanyQueryFilters;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseInt(value, 10);
                }), (0, class_validator_1.IsNumber)()];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return parseInt(value, 10);
                }), (0, class_validator_1.IsNumber)()];
            _search_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _companyType_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyType }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyType)];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyStatus)];
            _tag_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _segment_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _sortBy_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _sortOrder_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _search_decorators, { kind: "field", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; }, set: function (obj, value) { obj.search = value; } }, metadata: _metadata }, _search_initializers, _search_extraInitializers);
            __esDecorate(null, null, _companyType_decorators, { kind: "field", name: "companyType", static: false, private: false, access: { has: function (obj) { return "companyType" in obj; }, get: function (obj) { return obj.companyType; }, set: function (obj, value) { obj.companyType = value; } }, metadata: _metadata }, _companyType_initializers, _companyType_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _tag_decorators, { kind: "field", name: "tag", static: false, private: false, access: { has: function (obj) { return "tag" in obj; }, get: function (obj) { return obj.tag; }, set: function (obj, value) { obj.tag = value; } }, metadata: _metadata }, _tag_initializers, _tag_extraInitializers);
            __esDecorate(null, null, _segment_decorators, { kind: "field", name: "segment", static: false, private: false, access: { has: function (obj) { return "segment" in obj; }, get: function (obj) { return obj.segment; }, set: function (obj, value) { obj.segment = value; } }, metadata: _metadata }, _segment_initializers, _segment_extraInitializers);
            __esDecorate(null, null, _sortBy_decorators, { kind: "field", name: "sortBy", static: false, private: false, access: { has: function (obj) { return "sortBy" in obj; }, get: function (obj) { return obj.sortBy; }, set: function (obj, value) { obj.sortBy = value; } }, metadata: _metadata }, _sortBy_initializers, _sortBy_extraInitializers);
            __esDecorate(null, null, _sortOrder_decorators, { kind: "field", name: "sortOrder", static: false, private: false, access: { has: function (obj) { return "sortOrder" in obj; }, get: function (obj) { return obj.sortOrder; }, set: function (obj, value) { obj.sortOrder = value; } }, metadata: _metadata }, _sortOrder_initializers, _sortOrder_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CompanyQueryFilters = CompanyQueryFilters;
var BulkUpdateCompaniesDto = function () {
    var _a;
    var _companyIds_decorators;
    var _companyIds_initializers = [];
    var _companyIds_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _segments_decorators;
    var _segments_initializers = [];
    var _segments_extraInitializers = [];
    return _a = /** @class */ (function () {
            function BulkUpdateCompaniesDto() {
                this.companyIds = __runInitializers(this, _companyIds_initializers, void 0);
                this.status = (__runInitializers(this, _companyIds_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.tags = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.segments = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _segments_initializers, void 0));
                __runInitializers(this, _segments_extraInitializers);
            }
            return BulkUpdateCompaniesDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _companyIds_decorators = [(0, swagger_1.ApiProperty)({ example: ['uuid-1', 'uuid-2'] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ enum: client_1.CompanyStatus }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsEnum)(client_1.CompanyStatus)];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['VIP'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _segments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['Corporate Partner'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            __esDecorate(null, null, _companyIds_decorators, { kind: "field", name: "companyIds", static: false, private: false, access: { has: function (obj) { return "companyIds" in obj; }, get: function (obj) { return obj.companyIds; }, set: function (obj, value) { obj.companyIds = value; } }, metadata: _metadata }, _companyIds_initializers, _companyIds_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _segments_decorators, { kind: "field", name: "segments", static: false, private: false, access: { has: function (obj) { return "segments" in obj; }, get: function (obj) { return obj.segments; }, set: function (obj, value) { obj.segments = value; } }, metadata: _metadata }, _segments_initializers, _segments_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.BulkUpdateCompaniesDto = BulkUpdateCompaniesDto;
