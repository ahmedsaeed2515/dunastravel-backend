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
exports.UpsertPassengersDto = exports.PassengerDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var PassengerDto = function () {
    var _a;
    var _id_decorators;
    var _id_initializers = [];
    var _id_extraInitializers = [];
    var _passengerType_decorators;
    var _passengerType_initializers = [];
    var _passengerType_extraInitializers = [];
    var _fullName_decorators;
    var _fullName_initializers = [];
    var _fullName_extraInitializers = [];
    var _passportNumber_decorators;
    var _passportNumber_initializers = [];
    var _passportNumber_extraInitializers = [];
    var _passportExpiry_decorators;
    var _passportExpiry_initializers = [];
    var _passportExpiry_extraInitializers = [];
    var _dateOfBirth_decorators;
    var _dateOfBirth_initializers = [];
    var _dateOfBirth_extraInitializers = [];
    var _nationality_decorators;
    var _nationality_initializers = [];
    var _nationality_extraInitializers = [];
    return _a = /** @class */ (function () {
            function PassengerDto() {
                this.id = __runInitializers(this, _id_initializers, void 0);
                this.passengerType = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _passengerType_initializers, void 0));
                this.fullName = (__runInitializers(this, _passengerType_extraInitializers), __runInitializers(this, _fullName_initializers, void 0));
                this.passportNumber = (__runInitializers(this, _fullName_extraInitializers), __runInitializers(this, _passportNumber_initializers, void 0));
                this.passportExpiry = (__runInitializers(this, _passportNumber_extraInitializers), __runInitializers(this, _passportExpiry_initializers, void 0));
                this.dateOfBirth = (__runInitializers(this, _passportExpiry_extraInitializers), __runInitializers(this, _dateOfBirth_initializers, void 0));
                this.nationality = (__runInitializers(this, _dateOfBirth_extraInitializers), __runInitializers(this, _nationality_initializers, void 0));
                __runInitializers(this, _nationality_extraInitializers);
            }
            return PassengerDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _id_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'ID if updating an existing passenger' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _passengerType_decorators = [(0, swagger_1.ApiProperty)({ description: 'Type: adult, child, infant' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _fullName_decorators = [(0, swagger_1.ApiProperty)({ description: 'Full name' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _passportNumber_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Passport number' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            _passportExpiry_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Passport expiration date' }), (0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _dateOfBirth_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Date of birth' }), (0, class_validator_1.IsDateString)(), (0, class_validator_1.IsOptional)()];
            _nationality_decorators = [(0, swagger_1.ApiPropertyOptional)({ description: 'Nationality' }), (0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: function (obj) { return "id" in obj; }, get: function (obj) { return obj.id; }, set: function (obj, value) { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
            __esDecorate(null, null, _passengerType_decorators, { kind: "field", name: "passengerType", static: false, private: false, access: { has: function (obj) { return "passengerType" in obj; }, get: function (obj) { return obj.passengerType; }, set: function (obj, value) { obj.passengerType = value; } }, metadata: _metadata }, _passengerType_initializers, _passengerType_extraInitializers);
            __esDecorate(null, null, _fullName_decorators, { kind: "field", name: "fullName", static: false, private: false, access: { has: function (obj) { return "fullName" in obj; }, get: function (obj) { return obj.fullName; }, set: function (obj, value) { obj.fullName = value; } }, metadata: _metadata }, _fullName_initializers, _fullName_extraInitializers);
            __esDecorate(null, null, _passportNumber_decorators, { kind: "field", name: "passportNumber", static: false, private: false, access: { has: function (obj) { return "passportNumber" in obj; }, get: function (obj) { return obj.passportNumber; }, set: function (obj, value) { obj.passportNumber = value; } }, metadata: _metadata }, _passportNumber_initializers, _passportNumber_extraInitializers);
            __esDecorate(null, null, _passportExpiry_decorators, { kind: "field", name: "passportExpiry", static: false, private: false, access: { has: function (obj) { return "passportExpiry" in obj; }, get: function (obj) { return obj.passportExpiry; }, set: function (obj, value) { obj.passportExpiry = value; } }, metadata: _metadata }, _passportExpiry_initializers, _passportExpiry_extraInitializers);
            __esDecorate(null, null, _dateOfBirth_decorators, { kind: "field", name: "dateOfBirth", static: false, private: false, access: { has: function (obj) { return "dateOfBirth" in obj; }, get: function (obj) { return obj.dateOfBirth; }, set: function (obj, value) { obj.dateOfBirth = value; } }, metadata: _metadata }, _dateOfBirth_initializers, _dateOfBirth_extraInitializers);
            __esDecorate(null, null, _nationality_decorators, { kind: "field", name: "nationality", static: false, private: false, access: { has: function (obj) { return "nationality" in obj; }, get: function (obj) { return obj.nationality; }, set: function (obj, value) { obj.nationality = value; } }, metadata: _metadata }, _nationality_initializers, _nationality_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.PassengerDto = PassengerDto;
var UpsertPassengersDto = function () {
    var _a;
    var _passengers_decorators;
    var _passengers_initializers = [];
    var _passengers_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpsertPassengersDto() {
                this.passengers = __runInitializers(this, _passengers_initializers, void 0);
                __runInitializers(this, _passengers_extraInitializers);
            }
            return UpsertPassengersDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _passengers_decorators = [(0, swagger_1.ApiProperty)({ type: [PassengerDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return PassengerDto; })];
            __esDecorate(null, null, _passengers_decorators, { kind: "field", name: "passengers", static: false, private: false, access: { has: function (obj) { return "passengers" in obj; }, get: function (obj) { return obj.passengers; }, set: function (obj, value) { obj.passengers = value; } }, metadata: _metadata }, _passengers_initializers, _passengers_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpsertPassengersDto = UpsertPassengersDto;
