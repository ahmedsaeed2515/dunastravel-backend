"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
exports.BookingsController = void 0;
/* eslint-disable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
var common_1 = require("@nestjs/common");
var throttler_1 = require("@nestjs/throttler");
var swagger_1 = require("@nestjs/swagger");
var guards_1 = require("../../common/guards");
var BookingsController = function () {
    var _classDecorators = [(0, swagger_1.ApiTags)('Bookings'), (0, common_1.Controller)('bookings')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _createBooking_decorators;
    var _findUserBookings_decorators;
    var _findByReferenceCode_decorators;
    var _cancelBooking_decorators;
    var BookingsController = _classThis = /** @class */ (function () {
        function BookingsController_1(bookingsService) {
            this.bookingsService = (__runInitializers(this, _instanceExtraInitializers), bookingsService);
        }
        BookingsController_1.prototype.createBooking = function (dto, user, idempotencyKey) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                var _a;
                return __generator(this, function (_b) {
                    userId = (_a = user === null || user === void 0 ? void 0 : user.id) !== null && _a !== void 0 ? _a : null;
                    return [2 /*return*/, this.bookingsService.createBooking(dto, userId, idempotencyKey)];
                });
            });
        };
        BookingsController_1.prototype.findUserBookings = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.bookingsService.findUserBookings(user.id)];
                });
            });
        };
        BookingsController_1.prototype.findByReferenceCode = function (referenceCode, user, email) {
            return __awaiter(this, void 0, void 0, function () {
                var userId;
                var _a;
                return __generator(this, function (_b) {
                    userId = (_a = user === null || user === void 0 ? void 0 : user.id) !== null && _a !== void 0 ? _a : null;
                    return [2 /*return*/, this.bookingsService.findByReferenceCode(referenceCode, email, userId)];
                });
            });
        };
        BookingsController_1.prototype.cancelBooking = function (referenceCode, user, reason) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.bookingsService.cancelBooking(referenceCode, user.id, reason)];
                });
            });
        };
        return BookingsController_1;
    }());
    __setFunctionName(_classThis, "BookingsController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _createBooking_decorators = [(0, common_1.Post)(), (0, common_1.HttpCode)(201), (0, common_1.UseGuards)(guards_1.OptionalJwtAuthGuard), (0, swagger_1.ApiOperation)({ summary: 'Create a tour booking' }), (0, swagger_1.ApiCreatedResponse)({ description: 'Booking created successfully' }), (0, swagger_1.ApiBadRequestResponse)({ description: 'Validation failed or invalid tour' }), (0, swagger_1.ApiUnprocessableEntityResponse)({ description: 'Tour not available' })];
        _findUserBookings_decorators = [(0, common_1.Get)('me'), (0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, swagger_1.ApiOperation)({ summary: 'Get all bookings for current user' }), (0, swagger_1.ApiOkResponse)({ description: 'List of user bookings' })];
        _findByReferenceCode_decorators = [(0, common_1.Get)(':referenceCode'), (0, common_1.UseGuards)(guards_1.OptionalJwtAuthGuard), (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }), (0, swagger_1.ApiOperation)({ summary: 'Get booking summary by reference code' }), (0, swagger_1.ApiOkResponse)({ description: 'Booking summary' }), (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid reference format' }), (0, swagger_1.ApiNotFoundResponse)({ description: 'Booking not found' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', example: 'BKG-A4X7Z2' })];
        _cancelBooking_decorators = [(0, common_1.Post)(':referenceCode/cancel'), (0, common_1.UseGuards)(guards_1.JwtAuthGuard), (0, common_1.HttpCode)(200), (0, swagger_1.ApiOperation)({ summary: 'Cancel a booking (authenticated owner only)' }), (0, swagger_1.ApiOkResponse)({ description: 'Booking cancelled' }), (0, swagger_1.ApiParam)({ name: 'referenceCode', example: 'BKG-A4X7Z2' })];
        __esDecorate(_classThis, null, _createBooking_decorators, { kind: "method", name: "createBooking", static: false, private: false, access: { has: function (obj) { return "createBooking" in obj; }, get: function (obj) { return obj.createBooking; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findUserBookings_decorators, { kind: "method", name: "findUserBookings", static: false, private: false, access: { has: function (obj) { return "findUserBookings" in obj; }, get: function (obj) { return obj.findUserBookings; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _findByReferenceCode_decorators, { kind: "method", name: "findByReferenceCode", static: false, private: false, access: { has: function (obj) { return "findByReferenceCode" in obj; }, get: function (obj) { return obj.findByReferenceCode; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _cancelBooking_decorators, { kind: "method", name: "cancelBooking", static: false, private: false, access: { has: function (obj) { return "cancelBooking" in obj; }, get: function (obj) { return obj.cancelBooking; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BookingsController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BookingsController = _classThis;
}();
exports.BookingsController = BookingsController;
