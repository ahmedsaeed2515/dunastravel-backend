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
exports.AddCustomerDocumentDto = exports.AddCustomerNoteDto = exports.BulkUpdateCustomersDto = exports.UpdateCustomerCrmDto = exports.ListCustomersQueryDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var ListCustomersQueryDto = function () {
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
    var _isVip_decorators;
    var _isVip_initializers = [];
    var _isVip_extraInitializers = [];
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
            function ListCustomersQueryDto() {
                this.page = __runInitializers(this, _page_initializers, void 0);
                this.limit = (__runInitializers(this, _page_extraInitializers), __runInitializers(this, _limit_initializers, void 0));
                this.search = (__runInitializers(this, _limit_extraInitializers), __runInitializers(this, _search_initializers, void 0));
                this.isVip = (__runInitializers(this, _search_extraInitializers), __runInitializers(this, _isVip_initializers, void 0));
                this.status = (__runInitializers(this, _isVip_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.tag = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _tag_initializers, void 0));
                this.segment = (__runInitializers(this, _tag_extraInitializers), __runInitializers(this, _segment_initializers, void 0));
                this.sortBy = (__runInitializers(this, _segment_extraInitializers), __runInitializers(this, _sortBy_initializers, void 0));
                this.sortOrder = (__runInitializers(this, _sortBy_extraInitializers), __runInitializers(this, _sortOrder_initializers, void 0));
                __runInitializers(this, _sortOrder_extraInitializers);
            }
            return ListCustomersQueryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _page_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 1 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _limit_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 20 }), (0, class_validator_1.IsOptional)(), (0, class_transformer_1.Type)(function () { return Number; }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _search_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Search by name, email, phone, or passport',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isVip_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Filter by VIP status', example: 'true' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    description: 'Filter by account status (e.g. ACTIVE, INACTIVE, BLOCKED)',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _tag_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Filter by specific tag' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _segment_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Filter by customer segment' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _sortBy_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'createdAt' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _sortOrder_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'desc' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _page_decorators, { kind: "field", name: "page", static: false, private: false, access: { has: function (obj) { return "page" in obj; }, get: function (obj) { return obj.page; }, set: function (obj, value) { obj.page = value; } }, metadata: _metadata }, _page_initializers, _page_extraInitializers);
            __esDecorate(null, null, _limit_decorators, { kind: "field", name: "limit", static: false, private: false, access: { has: function (obj) { return "limit" in obj; }, get: function (obj) { return obj.limit; }, set: function (obj, value) { obj.limit = value; } }, metadata: _metadata }, _limit_initializers, _limit_extraInitializers);
            __esDecorate(null, null, _search_decorators, { kind: "field", name: "search", static: false, private: false, access: { has: function (obj) { return "search" in obj; }, get: function (obj) { return obj.search; }, set: function (obj, value) { obj.search = value; } }, metadata: _metadata }, _search_initializers, _search_extraInitializers);
            __esDecorate(null, null, _isVip_decorators, { kind: "field", name: "isVip", static: false, private: false, access: { has: function (obj) { return "isVip" in obj; }, get: function (obj) { return obj.isVip; }, set: function (obj, value) { obj.isVip = value; } }, metadata: _metadata }, _isVip_initializers, _isVip_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _tag_decorators, { kind: "field", name: "tag", static: false, private: false, access: { has: function (obj) { return "tag" in obj; }, get: function (obj) { return obj.tag; }, set: function (obj, value) { obj.tag = value; } }, metadata: _metadata }, _tag_initializers, _tag_extraInitializers);
            __esDecorate(null, null, _segment_decorators, { kind: "field", name: "segment", static: false, private: false, access: { has: function (obj) { return "segment" in obj; }, get: function (obj) { return obj.segment; }, set: function (obj, value) { obj.segment = value; } }, metadata: _metadata }, _segment_initializers, _segment_extraInitializers);
            __esDecorate(null, null, _sortBy_decorators, { kind: "field", name: "sortBy", static: false, private: false, access: { has: function (obj) { return "sortBy" in obj; }, get: function (obj) { return obj.sortBy; }, set: function (obj, value) { obj.sortBy = value; } }, metadata: _metadata }, _sortBy_initializers, _sortBy_extraInitializers);
            __esDecorate(null, null, _sortOrder_decorators, { kind: "field", name: "sortOrder", static: false, private: false, access: { has: function (obj) { return "sortOrder" in obj; }, get: function (obj) { return obj.sortOrder; }, set: function (obj, value) { obj.sortOrder = value; } }, metadata: _metadata }, _sortOrder_initializers, _sortOrder_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.ListCustomersQueryDto = ListCustomersQueryDto;
var UpdateCustomerCrmDto = function () {
    var _a;
    var _customerNumber_decorators;
    var _customerNumber_initializers = [];
    var _customerNumber_extraInitializers = [];
    var _isVip_decorators;
    var _isVip_initializers = [];
    var _isVip_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _segments_decorators;
    var _segments_initializers = [];
    var _segments_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    var _passportNumber_decorators;
    var _passportNumber_initializers = [];
    var _passportNumber_extraInitializers = [];
    var _nationality_decorators;
    var _nationality_initializers = [];
    var _nationality_extraInitializers = [];
    var _gender_decorators;
    var _gender_initializers = [];
    var _gender_extraInitializers = [];
    var _dateOfBirth_decorators;
    var _dateOfBirth_initializers = [];
    var _dateOfBirth_extraInitializers = [];
    var _emergencyContact_decorators;
    var _emergencyContact_initializers = [];
    var _emergencyContact_extraInitializers = [];
    var _address_decorators;
    var _address_initializers = [];
    var _address_extraInitializers = [];
    var _preferredLanguage_decorators;
    var _preferredLanguage_initializers = [];
    var _preferredLanguage_extraInitializers = [];
    var _preferredCurrency_decorators;
    var _preferredCurrency_initializers = [];
    var _preferredCurrency_extraInitializers = [];
    var _preferredDestination_decorators;
    var _preferredDestination_initializers = [];
    var _preferredDestination_extraInitializers = [];
    var _preferredTravelType_decorators;
    var _preferredTravelType_initializers = [];
    var _preferredTravelType_extraInitializers = [];
    var _familyMembers_decorators;
    var _familyMembers_initializers = [];
    var _familyMembers_extraInitializers = [];
    var _travelCompanions_decorators;
    var _travelCompanions_initializers = [];
    var _travelCompanions_extraInitializers = [];
    var _marketingConsent_decorators;
    var _marketingConsent_initializers = [];
    var _marketingConsent_extraInitializers = [];
    var _phoneVerified_decorators;
    var _phoneVerified_initializers = [];
    var _phoneVerified_extraInitializers = [];
    var _customerSource_decorators;
    var _customerSource_initializers = [];
    var _customerSource_extraInitializers = [];
    var _referralSource_decorators;
    var _referralSource_initializers = [];
    var _referralSource_extraInitializers = [];
    var _futureCompanyId_decorators;
    var _futureCompanyId_initializers = [];
    var _futureCompanyId_extraInitializers = [];
    var _futureWalletId_decorators;
    var _futureWalletId_initializers = [];
    var _futureWalletId_extraInitializers = [];
    var _futureCommissionPlan_decorators;
    var _futureCommissionPlan_initializers = [];
    var _futureCommissionPlan_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateCustomerCrmDto() {
                this.customerNumber = __runInitializers(this, _customerNumber_initializers, void 0);
                this.isVip = (__runInitializers(this, _customerNumber_extraInitializers), __runInitializers(this, _isVip_initializers, void 0));
                this.tags = (__runInitializers(this, _isVip_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.segments = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _segments_initializers, void 0));
                this.status = (__runInitializers(this, _segments_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                this.passportNumber = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _passportNumber_initializers, void 0));
                this.nationality = (__runInitializers(this, _passportNumber_extraInitializers), __runInitializers(this, _nationality_initializers, void 0));
                this.gender = (__runInitializers(this, _nationality_extraInitializers), __runInitializers(this, _gender_initializers, void 0));
                this.dateOfBirth = (__runInitializers(this, _gender_extraInitializers), __runInitializers(this, _dateOfBirth_initializers, void 0));
                this.emergencyContact = (__runInitializers(this, _dateOfBirth_extraInitializers), __runInitializers(this, _emergencyContact_initializers, void 0));
                this.address = (__runInitializers(this, _emergencyContact_extraInitializers), __runInitializers(this, _address_initializers, void 0));
                this.preferredLanguage = (__runInitializers(this, _address_extraInitializers), __runInitializers(this, _preferredLanguage_initializers, void 0));
                this.preferredCurrency = (__runInitializers(this, _preferredLanguage_extraInitializers), __runInitializers(this, _preferredCurrency_initializers, void 0));
                this.preferredDestination = (__runInitializers(this, _preferredCurrency_extraInitializers), __runInitializers(this, _preferredDestination_initializers, void 0));
                this.preferredTravelType = (__runInitializers(this, _preferredDestination_extraInitializers), __runInitializers(this, _preferredTravelType_initializers, void 0));
                this.familyMembers = (__runInitializers(this, _preferredTravelType_extraInitializers), __runInitializers(this, _familyMembers_initializers, void 0));
                this.travelCompanions = (__runInitializers(this, _familyMembers_extraInitializers), __runInitializers(this, _travelCompanions_initializers, void 0));
                this.marketingConsent = (__runInitializers(this, _travelCompanions_extraInitializers), __runInitializers(this, _marketingConsent_initializers, void 0));
                this.phoneVerified = (__runInitializers(this, _marketingConsent_extraInitializers), __runInitializers(this, _phoneVerified_initializers, void 0));
                this.customerSource = (__runInitializers(this, _phoneVerified_extraInitializers), __runInitializers(this, _customerSource_initializers, void 0));
                this.referralSource = (__runInitializers(this, _customerSource_extraInitializers), __runInitializers(this, _referralSource_initializers, void 0));
                this.futureCompanyId = (__runInitializers(this, _referralSource_extraInitializers), __runInitializers(this, _futureCompanyId_initializers, void 0));
                this.futureWalletId = (__runInitializers(this, _futureCompanyId_extraInitializers), __runInitializers(this, _futureWalletId_initializers, void 0));
                this.futureCommissionPlan = (__runInitializers(this, _futureWalletId_extraInitializers), __runInitializers(this, _futureCommissionPlan_initializers, void 0));
                __runInitializers(this, _futureCommissionPlan_extraInitializers);
            }
            return UpdateCustomerCrmDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _customerNumber_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'CUST-2026-0001' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isVip_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['HighValue', 'Repeat'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _segments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['VIP', 'Corporate'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'ACTIVE' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _passportNumber_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'P12345678' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _nationality_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Egyptian' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _gender_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Male' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _dateOfBirth_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '1985-05-15' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _emergencyContact_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: {
                        name: 'Sarah Connor',
                        relationship: 'Spouse',
                        phone: '+123456789',
                    },
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _address_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: { street: '123 Nile Ave', city: 'Cairo', country: 'Egypt' },
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsObject)()];
            _preferredLanguage_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'en' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _preferredCurrency_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'USD' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _preferredDestination_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Sharm El Sheikh' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _preferredTravelType_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Luxury Private' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _familyMembers_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: [{ name: 'John Jr', relationship: 'Son', age: 10 }],
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)()];
            _travelCompanions_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: [{ name: 'Alice', relationship: 'Friend' }] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)()];
            _marketingConsent_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _phoneVerified_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _customerSource_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'WEB' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _referralSource_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'VIP Referral' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _futureCompanyId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _futureWalletId_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _futureCommissionPlan_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _customerNumber_decorators, { kind: "field", name: "customerNumber", static: false, private: false, access: { has: function (obj) { return "customerNumber" in obj; }, get: function (obj) { return obj.customerNumber; }, set: function (obj, value) { obj.customerNumber = value; } }, metadata: _metadata }, _customerNumber_initializers, _customerNumber_extraInitializers);
            __esDecorate(null, null, _isVip_decorators, { kind: "field", name: "isVip", static: false, private: false, access: { has: function (obj) { return "isVip" in obj; }, get: function (obj) { return obj.isVip; }, set: function (obj, value) { obj.isVip = value; } }, metadata: _metadata }, _isVip_initializers, _isVip_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _segments_decorators, { kind: "field", name: "segments", static: false, private: false, access: { has: function (obj) { return "segments" in obj; }, get: function (obj) { return obj.segments; }, set: function (obj, value) { obj.segments = value; } }, metadata: _metadata }, _segments_initializers, _segments_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            __esDecorate(null, null, _passportNumber_decorators, { kind: "field", name: "passportNumber", static: false, private: false, access: { has: function (obj) { return "passportNumber" in obj; }, get: function (obj) { return obj.passportNumber; }, set: function (obj, value) { obj.passportNumber = value; } }, metadata: _metadata }, _passportNumber_initializers, _passportNumber_extraInitializers);
            __esDecorate(null, null, _nationality_decorators, { kind: "field", name: "nationality", static: false, private: false, access: { has: function (obj) { return "nationality" in obj; }, get: function (obj) { return obj.nationality; }, set: function (obj, value) { obj.nationality = value; } }, metadata: _metadata }, _nationality_initializers, _nationality_extraInitializers);
            __esDecorate(null, null, _gender_decorators, { kind: "field", name: "gender", static: false, private: false, access: { has: function (obj) { return "gender" in obj; }, get: function (obj) { return obj.gender; }, set: function (obj, value) { obj.gender = value; } }, metadata: _metadata }, _gender_initializers, _gender_extraInitializers);
            __esDecorate(null, null, _dateOfBirth_decorators, { kind: "field", name: "dateOfBirth", static: false, private: false, access: { has: function (obj) { return "dateOfBirth" in obj; }, get: function (obj) { return obj.dateOfBirth; }, set: function (obj, value) { obj.dateOfBirth = value; } }, metadata: _metadata }, _dateOfBirth_initializers, _dateOfBirth_extraInitializers);
            __esDecorate(null, null, _emergencyContact_decorators, { kind: "field", name: "emergencyContact", static: false, private: false, access: { has: function (obj) { return "emergencyContact" in obj; }, get: function (obj) { return obj.emergencyContact; }, set: function (obj, value) { obj.emergencyContact = value; } }, metadata: _metadata }, _emergencyContact_initializers, _emergencyContact_extraInitializers);
            __esDecorate(null, null, _address_decorators, { kind: "field", name: "address", static: false, private: false, access: { has: function (obj) { return "address" in obj; }, get: function (obj) { return obj.address; }, set: function (obj, value) { obj.address = value; } }, metadata: _metadata }, _address_initializers, _address_extraInitializers);
            __esDecorate(null, null, _preferredLanguage_decorators, { kind: "field", name: "preferredLanguage", static: false, private: false, access: { has: function (obj) { return "preferredLanguage" in obj; }, get: function (obj) { return obj.preferredLanguage; }, set: function (obj, value) { obj.preferredLanguage = value; } }, metadata: _metadata }, _preferredLanguage_initializers, _preferredLanguage_extraInitializers);
            __esDecorate(null, null, _preferredCurrency_decorators, { kind: "field", name: "preferredCurrency", static: false, private: false, access: { has: function (obj) { return "preferredCurrency" in obj; }, get: function (obj) { return obj.preferredCurrency; }, set: function (obj, value) { obj.preferredCurrency = value; } }, metadata: _metadata }, _preferredCurrency_initializers, _preferredCurrency_extraInitializers);
            __esDecorate(null, null, _preferredDestination_decorators, { kind: "field", name: "preferredDestination", static: false, private: false, access: { has: function (obj) { return "preferredDestination" in obj; }, get: function (obj) { return obj.preferredDestination; }, set: function (obj, value) { obj.preferredDestination = value; } }, metadata: _metadata }, _preferredDestination_initializers, _preferredDestination_extraInitializers);
            __esDecorate(null, null, _preferredTravelType_decorators, { kind: "field", name: "preferredTravelType", static: false, private: false, access: { has: function (obj) { return "preferredTravelType" in obj; }, get: function (obj) { return obj.preferredTravelType; }, set: function (obj, value) { obj.preferredTravelType = value; } }, metadata: _metadata }, _preferredTravelType_initializers, _preferredTravelType_extraInitializers);
            __esDecorate(null, null, _familyMembers_decorators, { kind: "field", name: "familyMembers", static: false, private: false, access: { has: function (obj) { return "familyMembers" in obj; }, get: function (obj) { return obj.familyMembers; }, set: function (obj, value) { obj.familyMembers = value; } }, metadata: _metadata }, _familyMembers_initializers, _familyMembers_extraInitializers);
            __esDecorate(null, null, _travelCompanions_decorators, { kind: "field", name: "travelCompanions", static: false, private: false, access: { has: function (obj) { return "travelCompanions" in obj; }, get: function (obj) { return obj.travelCompanions; }, set: function (obj, value) { obj.travelCompanions = value; } }, metadata: _metadata }, _travelCompanions_initializers, _travelCompanions_extraInitializers);
            __esDecorate(null, null, _marketingConsent_decorators, { kind: "field", name: "marketingConsent", static: false, private: false, access: { has: function (obj) { return "marketingConsent" in obj; }, get: function (obj) { return obj.marketingConsent; }, set: function (obj, value) { obj.marketingConsent = value; } }, metadata: _metadata }, _marketingConsent_initializers, _marketingConsent_extraInitializers);
            __esDecorate(null, null, _phoneVerified_decorators, { kind: "field", name: "phoneVerified", static: false, private: false, access: { has: function (obj) { return "phoneVerified" in obj; }, get: function (obj) { return obj.phoneVerified; }, set: function (obj, value) { obj.phoneVerified = value; } }, metadata: _metadata }, _phoneVerified_initializers, _phoneVerified_extraInitializers);
            __esDecorate(null, null, _customerSource_decorators, { kind: "field", name: "customerSource", static: false, private: false, access: { has: function (obj) { return "customerSource" in obj; }, get: function (obj) { return obj.customerSource; }, set: function (obj, value) { obj.customerSource = value; } }, metadata: _metadata }, _customerSource_initializers, _customerSource_extraInitializers);
            __esDecorate(null, null, _referralSource_decorators, { kind: "field", name: "referralSource", static: false, private: false, access: { has: function (obj) { return "referralSource" in obj; }, get: function (obj) { return obj.referralSource; }, set: function (obj, value) { obj.referralSource = value; } }, metadata: _metadata }, _referralSource_initializers, _referralSource_extraInitializers);
            __esDecorate(null, null, _futureCompanyId_decorators, { kind: "field", name: "futureCompanyId", static: false, private: false, access: { has: function (obj) { return "futureCompanyId" in obj; }, get: function (obj) { return obj.futureCompanyId; }, set: function (obj, value) { obj.futureCompanyId = value; } }, metadata: _metadata }, _futureCompanyId_initializers, _futureCompanyId_extraInitializers);
            __esDecorate(null, null, _futureWalletId_decorators, { kind: "field", name: "futureWalletId", static: false, private: false, access: { has: function (obj) { return "futureWalletId" in obj; }, get: function (obj) { return obj.futureWalletId; }, set: function (obj, value) { obj.futureWalletId = value; } }, metadata: _metadata }, _futureWalletId_initializers, _futureWalletId_extraInitializers);
            __esDecorate(null, null, _futureCommissionPlan_decorators, { kind: "field", name: "futureCommissionPlan", static: false, private: false, access: { has: function (obj) { return "futureCommissionPlan" in obj; }, get: function (obj) { return obj.futureCommissionPlan; }, set: function (obj, value) { obj.futureCommissionPlan = value; } }, metadata: _metadata }, _futureCommissionPlan_initializers, _futureCommissionPlan_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateCustomerCrmDto = UpdateCustomerCrmDto;
var BulkUpdateCustomersDto = function () {
    var _a;
    var _userIds_decorators;
    var _userIds_initializers = [];
    var _userIds_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _segments_decorators;
    var _segments_initializers = [];
    var _segments_extraInitializers = [];
    var _isVip_decorators;
    var _isVip_initializers = [];
    var _isVip_extraInitializers = [];
    var _status_decorators;
    var _status_initializers = [];
    var _status_extraInitializers = [];
    return _a = /** @class */ (function () {
            function BulkUpdateCustomersDto() {
                this.userIds = __runInitializers(this, _userIds_initializers, void 0);
                this.tags = (__runInitializers(this, _userIds_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.segments = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _segments_initializers, void 0));
                this.isVip = (__runInitializers(this, _segments_extraInitializers), __runInitializers(this, _isVip_initializers, void 0));
                this.status = (__runInitializers(this, _isVip_extraInitializers), __runInitializers(this, _status_initializers, void 0));
                __runInitializers(this, _status_extraInitializers);
            }
            return BulkUpdateCustomersDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _userIds_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['uuid-1', 'uuid-2'] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['VIP', 'Summer2026'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _segments_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: ['Corporate'] }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _isVip_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            _status_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'INACTIVE' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _userIds_decorators, { kind: "field", name: "userIds", static: false, private: false, access: { has: function (obj) { return "userIds" in obj; }, get: function (obj) { return obj.userIds; }, set: function (obj, value) { obj.userIds = value; } }, metadata: _metadata }, _userIds_initializers, _userIds_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _segments_decorators, { kind: "field", name: "segments", static: false, private: false, access: { has: function (obj) { return "segments" in obj; }, get: function (obj) { return obj.segments; }, set: function (obj, value) { obj.segments = value; } }, metadata: _metadata }, _segments_initializers, _segments_extraInitializers);
            __esDecorate(null, null, _isVip_decorators, { kind: "field", name: "isVip", static: false, private: false, access: { has: function (obj) { return "isVip" in obj; }, get: function (obj) { return obj.isVip; }, set: function (obj, value) { obj.isVip = value; } }, metadata: _metadata }, _isVip_initializers, _isVip_extraInitializers);
            __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: function (obj) { return "status" in obj; }, get: function (obj) { return obj.status; }, set: function (obj, value) { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.BulkUpdateCustomersDto = BulkUpdateCustomersDto;
var AddCustomerNoteDto = function () {
    var _a;
    var _content_decorators;
    var _content_initializers = [];
    var _content_extraInitializers = [];
    var _noteType_decorators;
    var _noteType_initializers = [];
    var _noteType_extraInitializers = [];
    var _isPinned_decorators;
    var _isPinned_initializers = [];
    var _isPinned_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AddCustomerNoteDto() {
                this.content = __runInitializers(this, _content_initializers, void 0);
                this.noteType = (__runInitializers(this, _content_extraInitializers), __runInitializers(this, _noteType_initializers, void 0));
                this.isPinned = (__runInitializers(this, _noteType_extraInitializers), __runInitializers(this, _isPinned_initializers, void 0));
                __runInitializers(this, _isPinned_extraInitializers);
            }
            return AddCustomerNoteDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _content_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Customer prefers suites with Nile view.' }), (0, class_validator_1.IsString)()];
            _noteType_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'SALES' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _isPinned_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: true }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsBoolean)()];
            __esDecorate(null, null, _content_decorators, { kind: "field", name: "content", static: false, private: false, access: { has: function (obj) { return "content" in obj; }, get: function (obj) { return obj.content; }, set: function (obj, value) { obj.content = value; } }, metadata: _metadata }, _content_initializers, _content_extraInitializers);
            __esDecorate(null, null, _noteType_decorators, { kind: "field", name: "noteType", static: false, private: false, access: { has: function (obj) { return "noteType" in obj; }, get: function (obj) { return obj.noteType; }, set: function (obj, value) { obj.noteType = value; } }, metadata: _metadata }, _noteType_initializers, _noteType_extraInitializers);
            __esDecorate(null, null, _isPinned_decorators, { kind: "field", name: "isPinned", static: false, private: false, access: { has: function (obj) { return "isPinned" in obj; }, get: function (obj) { return obj.isPinned; }, set: function (obj, value) { obj.isPinned = value; } }, metadata: _metadata }, _isPinned_initializers, _isPinned_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AddCustomerNoteDto = AddCustomerNoteDto;
var AddCustomerDocumentDto = function () {
    var _a;
    var _mediaAssetId_decorators;
    var _mediaAssetId_initializers = [];
    var _mediaAssetId_extraInitializers = [];
    var _documentType_decorators;
    var _documentType_initializers = [];
    var _documentType_extraInitializers = [];
    var _title_decorators;
    var _title_initializers = [];
    var _title_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AddCustomerDocumentDto() {
                this.mediaAssetId = __runInitializers(this, _mediaAssetId_initializers, void 0);
                this.documentType = (__runInitializers(this, _mediaAssetId_extraInitializers), __runInitializers(this, _documentType_initializers, void 0));
                this.title = (__runInitializers(this, _documentType_extraInitializers), __runInitializers(this, _title_initializers, void 0));
                __runInitializers(this, _title_extraInitializers);
            }
            return AddCustomerDocumentDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _mediaAssetId_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'media-uuid-1' }), (0, class_validator_1.IsString)()];
            _documentType_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'PASSPORT' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            _title_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'Passport Scan 2026' }), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _mediaAssetId_decorators, { kind: "field", name: "mediaAssetId", static: false, private: false, access: { has: function (obj) { return "mediaAssetId" in obj; }, get: function (obj) { return obj.mediaAssetId; }, set: function (obj, value) { obj.mediaAssetId = value; } }, metadata: _metadata }, _mediaAssetId_initializers, _mediaAssetId_extraInitializers);
            __esDecorate(null, null, _documentType_decorators, { kind: "field", name: "documentType", static: false, private: false, access: { has: function (obj) { return "documentType" in obj; }, get: function (obj) { return obj.documentType; }, set: function (obj, value) { obj.documentType = value; } }, metadata: _metadata }, _documentType_initializers, _documentType_extraInitializers);
            __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: function (obj) { return "title" in obj; }, get: function (obj) { return obj.title; }, set: function (obj, value) { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AddCustomerDocumentDto = AddCustomerDocumentDto;
