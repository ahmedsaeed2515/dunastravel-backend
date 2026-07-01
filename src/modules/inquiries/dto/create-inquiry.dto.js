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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateInquiryDto = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var IsEndDateAfterStartConstraint = function () {
    var _classDecorators = [(0, class_validator_1.ValidatorConstraint)({ name: 'IsEndDateAfterStart', async: false })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var IsEndDateAfterStartConstraint = _classThis = /** @class */ (function () {
        function IsEndDateAfterStartConstraint_1() {
        }
        IsEndDateAfterStartConstraint_1.prototype.validate = function (value, args) {
            var obj = args.object;
            if (!obj.startDate || !value)
                return true;
            return new Date(value) >= new Date(obj.startDate);
        };
        IsEndDateAfterStartConstraint_1.prototype.defaultMessage = function () {
            return 'endDate must not be before startDate';
        };
        return IsEndDateAfterStartConstraint_1;
    }());
    __setFunctionName(_classThis, "IsEndDateAfterStartConstraint");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        IsEndDateAfterStartConstraint = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return IsEndDateAfterStartConstraint = _classThis;
}();
var CreateInquiryDto = function () {
    var _a;
    var _fullName_decorators;
    var _fullName_initializers = [];
    var _fullName_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _phone_decorators;
    var _phone_initializers = [];
    var _phone_extraInitializers = [];
    var _preferredLanguage_decorators;
    var _preferredLanguage_initializers = [];
    var _preferredLanguage_extraInitializers = [];
    var _destinations_decorators;
    var _destinations_initializers = [];
    var _destinations_extraInitializers = [];
    var _startDate_decorators;
    var _startDate_initializers = [];
    var _startDate_extraInitializers = [];
    var _endDate_decorators;
    var _endDate_initializers = [];
    var _endDate_extraInitializers = [];
    var _adults_decorators;
    var _adults_initializers = [];
    var _adults_extraInitializers = [];
    var _children_decorators;
    var _children_initializers = [];
    var _children_extraInitializers = [];
    var _budgetAmount_decorators;
    var _budgetAmount_initializers = [];
    var _budgetAmount_extraInitializers = [];
    var _budgetCurrency_decorators;
    var _budgetCurrency_initializers = [];
    var _budgetCurrency_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateInquiryDto() {
                this.fullName = __runInitializers(this, _fullName_initializers, void 0);
                this.email = (__runInitializers(this, _fullName_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.phone = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _phone_initializers, void 0));
                this.preferredLanguage = (__runInitializers(this, _phone_extraInitializers), __runInitializers(this, _preferredLanguage_initializers, void 0));
                this.destinations = (__runInitializers(this, _preferredLanguage_extraInitializers), __runInitializers(this, _destinations_initializers, void 0));
                this.startDate = (__runInitializers(this, _destinations_extraInitializers), __runInitializers(this, _startDate_initializers, void 0));
                this.endDate = (__runInitializers(this, _startDate_extraInitializers), __runInitializers(this, _endDate_initializers, void 0));
                this.adults = (__runInitializers(this, _endDate_extraInitializers), __runInitializers(this, _adults_initializers, void 0));
                this.children = (__runInitializers(this, _adults_extraInitializers), __runInitializers(this, _children_initializers, 0));
                this.budgetAmount = (__runInitializers(this, _children_extraInitializers), __runInitializers(this, _budgetAmount_initializers, void 0));
                this.budgetCurrency = (__runInitializers(this, _budgetAmount_extraInitializers), __runInitializers(this, _budgetCurrency_initializers, void 0));
                this.notes = (__runInitializers(this, _budgetCurrency_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                __runInitializers(this, _notes_extraInitializers);
            }
            return CreateInquiryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _fullName_decorators = [(0, swagger_1.ApiProperty)({ example: 'John Doe' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(255), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return typeof value === 'string' ? value.trim() : value;
                })];
            _email_decorators = [(0, swagger_1.ApiProperty)({ example: 'john@example.com' }), (0, class_validator_1.IsEmail)(), (0, class_validator_1.IsNotEmpty)(), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return typeof value === 'string' ? value.toLowerCase().trim() : value;
                })];
            _phone_decorators = [(0, swagger_1.ApiProperty)({ example: '+1 (555) 123-4567' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(50), (0, class_validator_1.Matches)(/^[\d\s\-+()]+$/, {
                    message: 'phone must contain only numbers, spaces, and valid symbols (+, -, (, ))',
                })];
            _preferredLanguage_decorators = [(0, swagger_1.ApiProperty)({ example: 'en', enum: ['en', 'es', 'fr', 'de', 'it', 'ar'] }), (0, class_validator_1.IsIn)(['en', 'es', 'fr', 'de', 'it', 'ar']), (0, class_validator_1.IsNotEmpty)()];
            _destinations_decorators = [(0, swagger_1.ApiProperty)({ type: [String], example: ['Cairo', 'Luxor'] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayMinSize)(1), (0, class_validator_1.ArrayMaxSize)(10), (0, class_validator_1.IsString)({ each: true }), (0, class_validator_1.MaxLength)(100, { each: true })];
            _startDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2027-10-01' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _endDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2027-10-15' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)(), (0, class_validator_1.Validate)(IsEndDateAfterStartConstraint)];
            _adults_decorators = [(0, swagger_1.ApiProperty)({ example: 2, minimum: 1, maximum: 50 }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1), (0, class_validator_1.Max)(50), (0, class_transformer_1.Type)(function () { return Number; })];
            _children_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 0, default: 0, minimum: 0, maximum: 50 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(0), (0, class_validator_1.Max)(50), (0, class_transformer_1.Type)(function () { return Number; })];
            _budgetAmount_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 5000.0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }), (0, class_validator_1.Min)(0), (0, class_transformer_1.Type)(function () { return Number; })];
            _budgetCurrency_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'USD' }), (0, class_validator_1.ValidateIf)(function (o) { return o.budgetAmount !== undefined && o.budgetAmount !== null; }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.Length)(3, 3), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return typeof value === 'string' ? value.toUpperCase() : value;
                })];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)({
                    example: 'We want a family friendly trip with lots of history.',
                }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(2000), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return typeof value === 'string' ? value.trim() : value;
                })];
            __esDecorate(null, null, _fullName_decorators, { kind: "field", name: "fullName", static: false, private: false, access: { has: function (obj) { return "fullName" in obj; }, get: function (obj) { return obj.fullName; }, set: function (obj, value) { obj.fullName = value; } }, metadata: _metadata }, _fullName_initializers, _fullName_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _phone_decorators, { kind: "field", name: "phone", static: false, private: false, access: { has: function (obj) { return "phone" in obj; }, get: function (obj) { return obj.phone; }, set: function (obj, value) { obj.phone = value; } }, metadata: _metadata }, _phone_initializers, _phone_extraInitializers);
            __esDecorate(null, null, _preferredLanguage_decorators, { kind: "field", name: "preferredLanguage", static: false, private: false, access: { has: function (obj) { return "preferredLanguage" in obj; }, get: function (obj) { return obj.preferredLanguage; }, set: function (obj, value) { obj.preferredLanguage = value; } }, metadata: _metadata }, _preferredLanguage_initializers, _preferredLanguage_extraInitializers);
            __esDecorate(null, null, _destinations_decorators, { kind: "field", name: "destinations", static: false, private: false, access: { has: function (obj) { return "destinations" in obj; }, get: function (obj) { return obj.destinations; }, set: function (obj, value) { obj.destinations = value; } }, metadata: _metadata }, _destinations_initializers, _destinations_extraInitializers);
            __esDecorate(null, null, _startDate_decorators, { kind: "field", name: "startDate", static: false, private: false, access: { has: function (obj) { return "startDate" in obj; }, get: function (obj) { return obj.startDate; }, set: function (obj, value) { obj.startDate = value; } }, metadata: _metadata }, _startDate_initializers, _startDate_extraInitializers);
            __esDecorate(null, null, _endDate_decorators, { kind: "field", name: "endDate", static: false, private: false, access: { has: function (obj) { return "endDate" in obj; }, get: function (obj) { return obj.endDate; }, set: function (obj, value) { obj.endDate = value; } }, metadata: _metadata }, _endDate_initializers, _endDate_extraInitializers);
            __esDecorate(null, null, _adults_decorators, { kind: "field", name: "adults", static: false, private: false, access: { has: function (obj) { return "adults" in obj; }, get: function (obj) { return obj.adults; }, set: function (obj, value) { obj.adults = value; } }, metadata: _metadata }, _adults_initializers, _adults_extraInitializers);
            __esDecorate(null, null, _children_decorators, { kind: "field", name: "children", static: false, private: false, access: { has: function (obj) { return "children" in obj; }, get: function (obj) { return obj.children; }, set: function (obj, value) { obj.children = value; } }, metadata: _metadata }, _children_initializers, _children_extraInitializers);
            __esDecorate(null, null, _budgetAmount_decorators, { kind: "field", name: "budgetAmount", static: false, private: false, access: { has: function (obj) { return "budgetAmount" in obj; }, get: function (obj) { return obj.budgetAmount; }, set: function (obj, value) { obj.budgetAmount = value; } }, metadata: _metadata }, _budgetAmount_initializers, _budgetAmount_extraInitializers);
            __esDecorate(null, null, _budgetCurrency_decorators, { kind: "field", name: "budgetCurrency", static: false, private: false, access: { has: function (obj) { return "budgetCurrency" in obj; }, get: function (obj) { return obj.budgetCurrency; }, set: function (obj, value) { obj.budgetCurrency = value; } }, metadata: _metadata }, _budgetCurrency_initializers, _budgetCurrency_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateInquiryDto = CreateInquiryDto;
