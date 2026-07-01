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
exports.UpdateBookingDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var UpdateBookingDto = function () {
    var _a;
    var _transportChoice_decorators;
    var _transportChoice_initializers = [];
    var _transportChoice_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    var _cancellationReason_decorators;
    var _cancellationReason_initializers = [];
    var _cancellationReason_extraInitializers = [];
    var _arrivalDate_decorators;
    var _arrivalDate_initializers = [];
    var _arrivalDate_extraInitializers = [];
    var _departureDate_decorators;
    var _departureDate_initializers = [];
    var _departureDate_extraInitializers = [];
    var _tags_decorators;
    var _tags_initializers = [];
    var _tags_extraInitializers = [];
    var _priority_decorators;
    var _priority_initializers = [];
    var _priority_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateBookingDto() {
                this.transportChoice = __runInitializers(this, _transportChoice_initializers, void 0);
                this.notes = (__runInitializers(this, _transportChoice_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                this.cancellationReason = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _cancellationReason_initializers, void 0));
                this.arrivalDate = (__runInitializers(this, _cancellationReason_extraInitializers), __runInitializers(this, _arrivalDate_initializers, void 0));
                this.departureDate = (__runInitializers(this, _arrivalDate_extraInitializers), __runInitializers(this, _departureDate_initializers, void 0));
                this.tags = (__runInitializers(this, _departureDate_extraInitializers), __runInitializers(this, _tags_initializers, void 0));
                this.priority = (__runInitializers(this, _tags_extraInitializers), __runInitializers(this, _priority_initializers, void 0));
                __runInitializers(this, _priority_extraInitializers);
            }
            return UpdateBookingDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _transportChoice_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _notes_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _cancellationReason_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _arrivalDate_decorators = [(0, swagger_1.ApiProperty)({ required: false }), (0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _departureDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Departure date' }), (0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _tags_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Tags for the booking' }), (0, class_validator_1.IsArray)(), (0, class_validator_1.IsString)({ each: true }), (0, class_validator_1.IsOptional)()];
            _priority_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Priority level' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _transportChoice_decorators, { kind: "field", name: "transportChoice", static: false, private: false, access: { has: function (obj) { return "transportChoice" in obj; }, get: function (obj) { return obj.transportChoice; }, set: function (obj, value) { obj.transportChoice = value; } }, metadata: _metadata }, _transportChoice_initializers, _transportChoice_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            __esDecorate(null, null, _cancellationReason_decorators, { kind: "field", name: "cancellationReason", static: false, private: false, access: { has: function (obj) { return "cancellationReason" in obj; }, get: function (obj) { return obj.cancellationReason; }, set: function (obj, value) { obj.cancellationReason = value; } }, metadata: _metadata }, _cancellationReason_initializers, _cancellationReason_extraInitializers);
            __esDecorate(null, null, _arrivalDate_decorators, { kind: "field", name: "arrivalDate", static: false, private: false, access: { has: function (obj) { return "arrivalDate" in obj; }, get: function (obj) { return obj.arrivalDate; }, set: function (obj, value) { obj.arrivalDate = value; } }, metadata: _metadata }, _arrivalDate_initializers, _arrivalDate_extraInitializers);
            __esDecorate(null, null, _departureDate_decorators, { kind: "field", name: "departureDate", static: false, private: false, access: { has: function (obj) { return "departureDate" in obj; }, get: function (obj) { return obj.departureDate; }, set: function (obj, value) { obj.departureDate = value; } }, metadata: _metadata }, _departureDate_initializers, _departureDate_extraInitializers);
            __esDecorate(null, null, _tags_decorators, { kind: "field", name: "tags", static: false, private: false, access: { has: function (obj) { return "tags" in obj; }, get: function (obj) { return obj.tags; }, set: function (obj, value) { obj.tags = value; } }, metadata: _metadata }, _tags_initializers, _tags_extraInitializers);
            __esDecorate(null, null, _priority_decorators, { kind: "field", name: "priority", static: false, private: false, access: { has: function (obj) { return "priority" in obj; }, get: function (obj) { return obj.priority; }, set: function (obj, value) { obj.priority = value; } }, metadata: _metadata }, _priority_initializers, _priority_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateBookingDto = UpdateBookingDto;
