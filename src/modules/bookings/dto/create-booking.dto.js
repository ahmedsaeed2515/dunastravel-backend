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
exports.CreateBookingDto = exports.PassengerCountMatchesConstraint = exports.IsFutureDateConstraint = void 0;
exports.IsFutureDate = IsFutureDate;
exports.PassengerCountMatches = PassengerCountMatches;
/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var swagger_1 = require("@nestjs/swagger");
var passenger_dto_1 = require("./passenger.dto");
var billing_info_dto_1 = require("./billing-info.dto");
var IsFutureDateConstraint = function () {
    var _classDecorators = [(0, class_validator_1.ValidatorConstraint)({ name: 'isFutureDate', async: false })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var IsFutureDateConstraint = _classThis = /** @class */ (function () {
        function IsFutureDateConstraint_1() {
        }
        IsFutureDateConstraint_1.prototype.validate = function (value) {
            if (!value)
                return false;
            var date = new Date(value);
            if (isNaN(date.getTime()))
                return false;
            var today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            return date > today;
        };
        IsFutureDateConstraint_1.prototype.defaultMessage = function () {
            return 'arrivalDate must be a future date';
        };
        return IsFutureDateConstraint_1;
    }());
    __setFunctionName(_classThis, "IsFutureDateConstraint");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        IsFutureDateConstraint = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return IsFutureDateConstraint = _classThis;
}();
exports.IsFutureDateConstraint = IsFutureDateConstraint;
function IsFutureDate() {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            target: object.constructor,
            propertyName: propertyName,
            options: {},
            constraints: [],
            validator: IsFutureDateConstraint,
        });
    };
}
var PassengerCountMatchesConstraint = function () {
    var _classDecorators = [(0, class_validator_1.ValidatorConstraint)({ name: 'passengerCountMatches', async: false })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PassengerCountMatchesConstraint = _classThis = /** @class */ (function () {
        function PassengerCountMatchesConstraint_1() {
        }
        PassengerCountMatchesConstraint_1.prototype.validate = function (passengerNames, args) {
            if (!Array.isArray(passengerNames))
                return false;
            var obj = args.object;
            var adultsCount = obj.adults || 0;
            var childrenCount = obj.children || 0;
            var infantsCount = obj.infants || 0;
            var currentAdults = passengerNames.filter(function (p) { return p.passengerType === 'adult'; }).length;
            var currentChildren = passengerNames.filter(function (p) { return p.passengerType === 'child'; }).length;
            var currentInfants = passengerNames.filter(function (p) { return p.passengerType === 'infant'; }).length;
            if (currentAdults === 0 && (currentChildren > 0 || currentInfants > 0)) {
                return false;
            }
            if (currentInfants > currentAdults * 2) {
                return false;
            }
            return (currentAdults === adultsCount &&
                currentChildren === childrenCount &&
                currentInfants <= infantsCount);
        };
        PassengerCountMatchesConstraint_1.prototype.defaultMessage = function () {
            return 'passengerNames count must match adults and children counts, require at least one adult if children/infants present, and maximum 2 infants per adult';
        };
        return PassengerCountMatchesConstraint_1;
    }());
    __setFunctionName(_classThis, "PassengerCountMatchesConstraint");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PassengerCountMatchesConstraint = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PassengerCountMatchesConstraint = _classThis;
}();
exports.PassengerCountMatchesConstraint = PassengerCountMatchesConstraint;
function PassengerCountMatches() {
    return function (object, propertyName) {
        (0, class_validator_1.registerDecorator)({
            target: object.constructor,
            propertyName: propertyName,
            options: {},
            constraints: [],
            validator: PassengerCountMatchesConstraint,
        });
    };
}
var CreateBookingDto = function () {
    var _a;
    var _tourId_decorators;
    var _tourId_initializers = [];
    var _tourId_extraInitializers = [];
    var _arrivalDate_decorators;
    var _arrivalDate_initializers = [];
    var _arrivalDate_extraInitializers = [];
    var _departureDate_decorators;
    var _departureDate_initializers = [];
    var _departureDate_extraInitializers = [];
    var _adults_decorators;
    var _adults_initializers = [];
    var _adults_extraInitializers = [];
    var _children_decorators;
    var _children_initializers = [];
    var _children_extraInitializers = [];
    var _infants_decorators;
    var _infants_initializers = [];
    var _infants_extraInitializers = [];
    var _transportChoice_decorators;
    var _transportChoice_initializers = [];
    var _transportChoice_extraInitializers = [];
    var _notes_decorators;
    var _notes_initializers = [];
    var _notes_extraInitializers = [];
    var _passengerNames_decorators;
    var _passengerNames_initializers = [];
    var _passengerNames_extraInitializers = [];
    var _billing_decorators;
    var _billing_initializers = [];
    var _billing_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateBookingDto() {
                this.tourId = __runInitializers(this, _tourId_initializers, void 0);
                this.arrivalDate = (__runInitializers(this, _tourId_extraInitializers), __runInitializers(this, _arrivalDate_initializers, void 0));
                this.departureDate = (__runInitializers(this, _arrivalDate_extraInitializers), __runInitializers(this, _departureDate_initializers, void 0));
                this.adults = (__runInitializers(this, _departureDate_extraInitializers), __runInitializers(this, _adults_initializers, void 0));
                this.children = (__runInitializers(this, _adults_extraInitializers), __runInitializers(this, _children_initializers, 0));
                this.infants = (__runInitializers(this, _children_extraInitializers), __runInitializers(this, _infants_initializers, 0));
                this.transportChoice = (__runInitializers(this, _infants_extraInitializers), __runInitializers(this, _transportChoice_initializers, void 0));
                this.notes = (__runInitializers(this, _transportChoice_extraInitializers), __runInitializers(this, _notes_initializers, void 0));
                this.passengerNames = (__runInitializers(this, _notes_extraInitializers), __runInitializers(this, _passengerNames_initializers, void 0));
                this.billing = (__runInitializers(this, _passengerNames_extraInitializers), __runInitializers(this, _billing_initializers, void 0));
                __runInitializers(this, _billing_extraInitializers);
            }
            return CreateBookingDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _tourId_decorators = [(0, swagger_1.ApiProperty)({ description: 'UUID of the tour to book' }), (0, class_validator_1.IsUUID)(4), (0, class_validator_1.IsNotEmpty)()];
            _arrivalDate_decorators = [(0, swagger_1.ApiProperty)({ example: '2027-03-15', description: 'Must be a future date' }), (0, class_validator_1.IsDateString)(), IsFutureDate()];
            _departureDate_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: '2027-03-22' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsDateString)()];
            _adults_decorators = [(0, swagger_1.ApiProperty)({ minimum: 1, maximum: 50, example: 2 }), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1), (0, class_validator_1.Max)(50), (0, class_transformer_1.Type)(function () { return Number; })];
            _children_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(0), (0, class_validator_1.Max)(50), (0, class_transformer_1.Type)(function () { return Number; })];
            _infants_decorators = [(0, swagger_1.ApiPropertyOptional)({ default: 0 }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(0), (0, class_validator_1.Max)(20), (0, class_transformer_1.Type)(function () { return Number; })];
            _transportChoice_decorators = [(0, swagger_1.ApiPropertyOptional)({ example: 'flight' }), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(100), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (typeof value === 'string' ? value.trim() : value);
                })];
            _notes_decorators = [(0, swagger_1.ApiPropertyOptional)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.IsString)(), (0, class_validator_1.MaxLength)(2000), (0, class_transformer_1.Transform)(function (_b) {
                    var value = _b.value;
                    return (typeof value === 'string' ? value.trim() : value);
                })];
            _passengerNames_decorators = [(0, swagger_1.ApiProperty)({ type: [passenger_dto_1.PassengerDto] }), (0, class_validator_1.IsArray)(), (0, class_validator_1.ArrayNotEmpty)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return passenger_dto_1.PassengerDto; }), PassengerCountMatches()];
            _billing_decorators = [(0, swagger_1.ApiProperty)({ type: billing_info_dto_1.BillingInfoDto }), (0, class_validator_1.ValidateNested)(), (0, class_transformer_1.Type)(function () { return billing_info_dto_1.BillingInfoDto; })];
            __esDecorate(null, null, _tourId_decorators, { kind: "field", name: "tourId", static: false, private: false, access: { has: function (obj) { return "tourId" in obj; }, get: function (obj) { return obj.tourId; }, set: function (obj, value) { obj.tourId = value; } }, metadata: _metadata }, _tourId_initializers, _tourId_extraInitializers);
            __esDecorate(null, null, _arrivalDate_decorators, { kind: "field", name: "arrivalDate", static: false, private: false, access: { has: function (obj) { return "arrivalDate" in obj; }, get: function (obj) { return obj.arrivalDate; }, set: function (obj, value) { obj.arrivalDate = value; } }, metadata: _metadata }, _arrivalDate_initializers, _arrivalDate_extraInitializers);
            __esDecorate(null, null, _departureDate_decorators, { kind: "field", name: "departureDate", static: false, private: false, access: { has: function (obj) { return "departureDate" in obj; }, get: function (obj) { return obj.departureDate; }, set: function (obj, value) { obj.departureDate = value; } }, metadata: _metadata }, _departureDate_initializers, _departureDate_extraInitializers);
            __esDecorate(null, null, _adults_decorators, { kind: "field", name: "adults", static: false, private: false, access: { has: function (obj) { return "adults" in obj; }, get: function (obj) { return obj.adults; }, set: function (obj, value) { obj.adults = value; } }, metadata: _metadata }, _adults_initializers, _adults_extraInitializers);
            __esDecorate(null, null, _children_decorators, { kind: "field", name: "children", static: false, private: false, access: { has: function (obj) { return "children" in obj; }, get: function (obj) { return obj.children; }, set: function (obj, value) { obj.children = value; } }, metadata: _metadata }, _children_initializers, _children_extraInitializers);
            __esDecorate(null, null, _infants_decorators, { kind: "field", name: "infants", static: false, private: false, access: { has: function (obj) { return "infants" in obj; }, get: function (obj) { return obj.infants; }, set: function (obj, value) { obj.infants = value; } }, metadata: _metadata }, _infants_initializers, _infants_extraInitializers);
            __esDecorate(null, null, _transportChoice_decorators, { kind: "field", name: "transportChoice", static: false, private: false, access: { has: function (obj) { return "transportChoice" in obj; }, get: function (obj) { return obj.transportChoice; }, set: function (obj, value) { obj.transportChoice = value; } }, metadata: _metadata }, _transportChoice_initializers, _transportChoice_extraInitializers);
            __esDecorate(null, null, _notes_decorators, { kind: "field", name: "notes", static: false, private: false, access: { has: function (obj) { return "notes" in obj; }, get: function (obj) { return obj.notes; }, set: function (obj, value) { obj.notes = value; } }, metadata: _metadata }, _notes_initializers, _notes_extraInitializers);
            __esDecorate(null, null, _passengerNames_decorators, { kind: "field", name: "passengerNames", static: false, private: false, access: { has: function (obj) { return "passengerNames" in obj; }, get: function (obj) { return obj.passengerNames; }, set: function (obj, value) { obj.passengerNames = value; } }, metadata: _metadata }, _passengerNames_initializers, _passengerNames_extraInitializers);
            __esDecorate(null, null, _billing_decorators, { kind: "field", name: "billing", static: false, private: false, access: { has: function (obj) { return "billing" in obj; }, get: function (obj) { return obj.billing; }, set: function (obj, value) { obj.billing = value; } }, metadata: _metadata }, _billing_initializers, _billing_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateBookingDto = CreateBookingDto;
