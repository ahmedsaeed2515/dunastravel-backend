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
exports.BookingCreatedListener = void 0;
var common_1 = require("@nestjs/common");
var event_emitter_1 = require("@nestjs/event-emitter");
var events_1 = require("../../../common/events");
var types_1 = require("../types");
var booking_confirmation_template_1 = require("../templates/booking-confirmation.template");
var booking_alert_template_1 = require("../templates/booking-alert.template");
var BookingCreatedListener = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _handleBookingCreatedEvent_decorators;
    var BookingCreatedListener = _classThis = /** @class */ (function () {
        function BookingCreatedListener_1(emailProvider, prisma, configService) {
            this.emailProvider = (__runInitializers(this, _instanceExtraInitializers), emailProvider);
            this.prisma = prisma;
            this.configService = configService;
            this.logger = new common_1.Logger(BookingCreatedListener.name);
            this.MAX_RETRIES = 3;
        }
        BookingCreatedListener_1.prototype.handleBookingCreatedEvent = function (payload) {
            return __awaiter(this, void 0, void 0, function () {
                var adminDashboardUrl, internalRecipient, customerPayload, salesPayload, error_1, err;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(payload === null || payload === void 0 ? void 0 : payload.referenceCode)) {
                                this.logger.error('Malformed booking.created payload received, skipping. Missing fields: referenceCode');
                                return [2 /*return*/];
                            }
                            if (!payload.customerEmail || !payload.customerEmail.includes('@')) {
                                this.logger.error('Malformed booking.created payload received, skipping. Missing fields: customerEmail');
                                return [2 /*return*/];
                            }
                            this.logger.log("Received booking.created event for referenceCode: ".concat(payload.referenceCode));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            adminDashboardUrl = this.configService.get('mail.adminDashboardBaseUrl') ||
                                'http://localhost:3000/admin';
                            internalRecipient = this.configService.get('mail.internalAlertRecipient') ||
                                'sales@dunastravel.com';
                            customerPayload = (0, booking_confirmation_template_1.renderBookingCustomerConfirmation)(payload);
                            salesPayload = (0, booking_alert_template_1.renderBookingInternalAlert)(payload, internalRecipient, adminDashboardUrl);
                            return [4 /*yield*/, Promise.all([
                                    this.deliverWithRetry(types_1.NotificationType.CUSTOMER_ACKNOWLEDGMENT, payload.referenceCode, customerPayload, 'customer'),
                                    this.deliverWithRetry(types_1.NotificationType.INTERNAL_SALES_ALERT, payload.referenceCode, salesPayload, 'sales team'),
                                ])];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            err = error_1 instanceof Error ? error_1 : new Error(String(error_1));
                            this.logger.error("Failed to process booking.created event: ".concat(err.message), err.stack);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        BookingCreatedListener_1.prototype.deliverWithRetry = function (notificationType, referenceCode, payload, recipientType) {
            return __awaiter(this, void 0, void 0, function () {
                var logRecord, attempts, success, result, error_2, err, isExhausted;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (recipientType === 'customer') {
                                this.logger.log("Sending booking confirmation to customer: ".concat(payload.to, " for booking: ").concat(referenceCode));
                            }
                            else {
                                this.logger.log("Sending booking alert to sales team for booking: ".concat(referenceCode));
                            }
                            this.logger.debug("Writing PENDING log for ".concat(referenceCode));
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.create({
                                    data: {
                                        notificationType: notificationType,
                                        originReferenceCode: referenceCode,
                                        originEntityType: 'BOOKING',
                                        recipientEmail: payload.to,
                                        status: types_1.NotificationDeliveryStatus.PENDING,
                                    },
                                })];
                        case 1:
                            logRecord = _a.sent();
                            attempts = 0;
                            success = false;
                            _a.label = 2;
                        case 2:
                            if (!(attempts < this.MAX_RETRIES && !success)) return [3 /*break*/, 14];
                            attempts++;
                            _a.label = 3;
                        case 3:
                            _a.trys.push([3, 8, , 13]);
                            return [4 /*yield*/, this.emailProvider.send(payload)];
                        case 4:
                            result = _a.sent();
                            if (!(result.status === 'SUCCESS')) return [3 /*break*/, 6];
                            success = true;
                            this.logger.debug("Writing SENT log for ".concat(referenceCode));
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.update({
                                    where: { id: logRecord.id },
                                    data: {
                                        status: types_1.NotificationDeliveryStatus.SENT,
                                        attempts: attempts,
                                        lastAttemptAt: new Date(),
                                        providerResponseId: result.providerMessageId,
                                    },
                                })];
                        case 5:
                            _a.sent();
                            this.logger.log("Booking confirmation delivered successfully for: ".concat(referenceCode, ", recipient: ").concat(recipientType));
                            return [3 /*break*/, 7];
                        case 6: throw new Error(result.providerError || 'Unknown provider error');
                        case 7: return [3 /*break*/, 13];
                        case 8:
                            error_2 = _a.sent();
                            err = error_2 instanceof Error ? error_2 : new Error(String(error_2));
                            this.logger.warn("Booking confirmation delivery attempt ".concat(attempts, "/").concat(this.MAX_RETRIES, " failed for: ").concat(referenceCode, ", recipient: ").concat(recipientType, ", error: ").concat(err.message));
                            isExhausted = attempts >= this.MAX_RETRIES;
                            this.logger.debug("Writing ".concat(isExhausted ? 'EXHAUSTED' : 'FAILED', " log for ").concat(referenceCode));
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.update({
                                    where: { id: logRecord.id },
                                    data: {
                                        status: isExhausted
                                            ? types_1.NotificationDeliveryStatus.EXHAUSTED
                                            : types_1.NotificationDeliveryStatus.FAILED,
                                        attempts: attempts,
                                        lastAttemptAt: new Date(),
                                        failureReason: err.message,
                                    },
                                })];
                        case 9:
                            _a.sent();
                            if (!isExhausted) return [3 /*break*/, 10];
                            this.logger.error("Booking confirmation permanently failed for: ".concat(referenceCode, ", recipient: ").concat(recipientType));
                            return [3 /*break*/, 12];
                        case 10: return [4 /*yield*/, new Promise(function (res) { return setTimeout(res, 1000 * attempts); })];
                        case 11:
                            _a.sent();
                            _a.label = 12;
                        case 12: return [3 /*break*/, 13];
                        case 13: return [3 /*break*/, 2];
                        case 14: return [2 /*return*/];
                    }
                });
            });
        };
        return BookingCreatedListener_1;
    }());
    __setFunctionName(_classThis, "BookingCreatedListener");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _handleBookingCreatedEvent_decorators = [(0, event_emitter_1.OnEvent)(events_1.BOOKING_EVENTS.CREATED, { async: true })];
        __esDecorate(_classThis, null, _handleBookingCreatedEvent_decorators, { kind: "method", name: "handleBookingCreatedEvent", static: false, private: false, access: { has: function (obj) { return "handleBookingCreatedEvent" in obj; }, get: function (obj) { return obj.handleBookingCreatedEvent; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BookingCreatedListener = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BookingCreatedListener = _classThis;
}();
exports.BookingCreatedListener = BookingCreatedListener;
