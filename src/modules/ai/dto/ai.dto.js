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
exports.AnalyzeCustomerDto = exports.GenerateItineraryDto = void 0;
var class_validator_1 = require("class-validator");
var swagger_1 = require("@nestjs/swagger");
var GenerateItineraryDto = function () {
    var _a;
    var _destinations_decorators;
    var _destinations_initializers = [];
    var _destinations_extraInitializers = [];
    var _days_decorators;
    var _days_initializers = [];
    var _days_extraInitializers = [];
    var _budgetUsd_decorators;
    var _budgetUsd_initializers = [];
    var _budgetUsd_extraInitializers = [];
    var _pax_decorators;
    var _pax_initializers = [];
    var _pax_extraInitializers = [];
    var _preferences_decorators;
    var _preferences_initializers = [];
    var _preferences_extraInitializers = [];
    return _a = /** @class */ (function () {
            function GenerateItineraryDto() {
                this.destinations = __runInitializers(this, _destinations_initializers, void 0);
                this.days = (__runInitializers(this, _destinations_extraInitializers), __runInitializers(this, _days_initializers, void 0));
                this.budgetUsd = (__runInitializers(this, _days_extraInitializers), __runInitializers(this, _budgetUsd_initializers, void 0));
                this.pax = (__runInitializers(this, _budgetUsd_extraInitializers), __runInitializers(this, _pax_initializers, void 0));
                this.preferences = (__runInitializers(this, _pax_extraInitializers), __runInitializers(this, _preferences_initializers, void 0));
                __runInitializers(this, _preferences_extraInitializers);
            }
            return GenerateItineraryDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _destinations_decorators = [(0, swagger_1.ApiProperty)({ description: 'List of destinations (e.g. Cairo, Luxor)' }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true })];
            _days_decorators = [(0, swagger_1.ApiProperty)({ description: 'Number of days' }), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _budgetUsd_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Total budget in USD' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _pax_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Number of travelers' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(1)];
            _preferences_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Special notes or preferences' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _destinations_decorators, { kind: "field", name: "destinations", static: false, private: false, access: { has: function (obj) { return "destinations" in obj; }, get: function (obj) { return obj.destinations; }, set: function (obj, value) { obj.destinations = value; } }, metadata: _metadata }, _destinations_initializers, _destinations_extraInitializers);
            __esDecorate(null, null, _days_decorators, { kind: "field", name: "days", static: false, private: false, access: { has: function (obj) { return "days" in obj; }, get: function (obj) { return obj.days; }, set: function (obj, value) { obj.days = value; } }, metadata: _metadata }, _days_initializers, _days_extraInitializers);
            __esDecorate(null, null, _budgetUsd_decorators, { kind: "field", name: "budgetUsd", static: false, private: false, access: { has: function (obj) { return "budgetUsd" in obj; }, get: function (obj) { return obj.budgetUsd; }, set: function (obj, value) { obj.budgetUsd = value; } }, metadata: _metadata }, _budgetUsd_initializers, _budgetUsd_extraInitializers);
            __esDecorate(null, null, _pax_decorators, { kind: "field", name: "pax", static: false, private: false, access: { has: function (obj) { return "pax" in obj; }, get: function (obj) { return obj.pax; }, set: function (obj, value) { obj.pax = value; } }, metadata: _metadata }, _pax_initializers, _pax_extraInitializers);
            __esDecorate(null, null, _preferences_decorators, { kind: "field", name: "preferences", static: false, private: false, access: { has: function (obj) { return "preferences" in obj; }, get: function (obj) { return obj.preferences; }, set: function (obj, value) { obj.preferences = value; } }, metadata: _metadata }, _preferences_initializers, _preferences_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.GenerateItineraryDto = GenerateItineraryDto;
var AnalyzeCustomerDto = function () {
    var _a;
    var _customerId_decorators;
    var _customerId_initializers = [];
    var _customerId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function AnalyzeCustomerDto() {
                this.customerId = __runInitializers(this, _customerId_initializers, void 0);
                __runInitializers(this, _customerId_extraInitializers);
            }
            return AnalyzeCustomerDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _customerId_decorators = [(0, swagger_1.ApiProperty)({ description: 'The Customer ID to analyze' }), (0, class_validator_1.IsString)()];
            __esDecorate(null, null, _customerId_decorators, { kind: "field", name: "customerId", static: false, private: false, access: { has: function (obj) { return "customerId" in obj; }, get: function (obj) { return obj.customerId; }, set: function (obj, value) { obj.customerId = value; } }, metadata: _metadata }, _customerId_initializers, _customerId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.AnalyzeCustomerDto = AnalyzeCustomerDto;
