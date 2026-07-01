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
exports.NotificationsService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var NotificationsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var NotificationsService = _classThis = /** @class */ (function () {
        function NotificationsService_1(prisma, emailComposition, emailDelivery, eventEmitter) {
            this.prisma = prisma;
            this.emailComposition = emailComposition;
            this.emailDelivery = emailDelivery;
            this.eventEmitter = eventEmitter;
            this.logger = new common_1.Logger(NotificationsService.name);
        }
        NotificationsService_1.prototype.findAllLogs = function (filters) {
            return __awaiter(this, void 0, void 0, function () {
                var _a, page, _b, limit, status, notificationType, recipientEmail, skip, where, _c, data, total;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = filters.page, page = _a === void 0 ? 1 : _a, _b = filters.limit, limit = _b === void 0 ? 10 : _b, status = filters.status, notificationType = filters.notificationType, recipientEmail = filters.recipientEmail;
                            skip = (page - 1) * limit;
                            where = {};
                            if (status)
                                where.status = status;
                            if (notificationType)
                                where.notificationType = notificationType;
                            if (recipientEmail)
                                where.recipientEmail = { contains: recipientEmail, mode: 'insensitive' };
                            return [4 /*yield*/, Promise.all([
                                    this.prisma.notificationDeliveryLog.findMany({
                                        where: where,
                                        skip: skip,
                                        take: Number(limit),
                                        orderBy: { createdAt: 'desc' },
                                    }),
                                    this.prisma.notificationDeliveryLog.count({ where: where }),
                                ])];
                        case 1:
                            _c = _d.sent(), data = _c[0], total = _c[1];
                            return [2 /*return*/, {
                                    data: data,
                                    meta: {
                                        total: total,
                                        page: page,
                                        limit: limit,
                                        totalPages: Math.ceil(total / limit),
                                    },
                                }];
                    }
                });
            });
        };
        NotificationsService_1.prototype.getMetrics = function () {
            return __awaiter(this, void 0, void 0, function () {
                var totalSent, totalFailed, totalPending, total, successRate;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.notificationDeliveryLog.count({
                                where: { status: client_1.NotificationDeliveryStatus.SENT },
                            })];
                        case 1:
                            totalSent = _a.sent();
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.count({
                                    where: {
                                        status: {
                                            in: [
                                                client_1.NotificationDeliveryStatus.FAILED,
                                                client_1.NotificationDeliveryStatus.EXHAUSTED,
                                            ],
                                        },
                                    },
                                })];
                        case 2:
                            totalFailed = _a.sent();
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.count({
                                    where: { status: client_1.NotificationDeliveryStatus.PENDING },
                                })];
                        case 3:
                            totalPending = _a.sent();
                            total = totalSent + totalFailed + totalPending;
                            successRate = total > 0 ? (totalSent / total) * 100 : 0;
                            return [2 /*return*/, {
                                    totalSent: totalSent,
                                    totalFailed: totalFailed,
                                    totalPending: totalPending,
                                    successRate: Math.round(successRate * 100) / 100,
                                }];
                    }
                });
            });
        };
        NotificationsService_1.prototype.retryNotification = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var log, _a, inquiry, payload, contact, payload;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.notificationDeliveryLog.findUnique({
                                where: { id: id },
                            })];
                        case 1:
                            log = _b.sent();
                            if (!log)
                                throw new common_1.NotFoundException('Notification log not found');
                            if (log.status === client_1.NotificationDeliveryStatus.SENT) {
                                throw new common_1.BadRequestException('Notification was already sent successfully');
                            }
                            // Reconstruct payload based on entity type to retry
                            // In a full production system, we would serialize the exact payload to S3 or a DB blob.
                            // For now, we will re-emit the domain event, which will trigger the listener and start fresh,
                            // OR we can manually fetch the entity and re-compose.
                            // The safest architectural way is to fetch the entity and manually call the services,
                            // but to avoid massive switch-case, we can just reset the log status to PENDING and trigger
                            // a background job. Here, we'll implement a simple switch for the supported types.
                            this.logger.log("Retrying notification ".concat(id, " for ").concat(log.originEntityType, " ").concat(log.originReferenceCode));
                            _a = log.originEntityType;
                            switch (_a) {
                                case 'INQUIRY': return [3 /*break*/, 2];
                                case 'CONTACT': return [3 /*break*/, 6];
                            }
                            return [3 /*break*/, 10];
                        case 2: return [4 /*yield*/, this.prisma.tailorMadeInquiry.findUnique({
                                where: { referenceCode: log.originReferenceCode },
                            })];
                        case 3:
                            inquiry = _b.sent();
                            if (!inquiry) return [3 /*break*/, 5];
                            payload = log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
                                ? this.emailComposition.composeInquiryCustomerAcknowledgment(inquiry)
                                : this.emailComposition.composeInquiryInternalAlert(inquiry);
                            // Deliver will create a NEW log entry since it doesn't take log ID.
                            // To avoid duplicates, we would typically update the existing log, but
                            // since EmailDeliveryService creates a new one, we will just call it and mark this one as EXHAUSTED/REPLACED.
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.update({
                                    where: { id: log.id },
                                    data: { failureReason: 'Retried manually (new log created)' },
                                })];
                        case 4:
                            // Deliver will create a NEW log entry since it doesn't take log ID.
                            // To avoid duplicates, we would typically update the existing log, but
                            // since EmailDeliveryService creates a new one, we will just call it and mark this one as EXHAUSTED/REPLACED.
                            _b.sent();
                            // Fire and forget
                            this.emailDelivery
                                .deliver(log.notificationType, inquiry.referenceCode, 'INQUIRY', payload)
                                .catch(function (e) { return console.error(e); });
                            return [2 /*return*/, { success: true, message: 'Retry initiated' }];
                        case 5: return [3 /*break*/, 11];
                        case 6: return [4 /*yield*/, this.prisma.contactSubmission.findUnique({
                                where: { referenceCode: log.originReferenceCode },
                            })];
                        case 7:
                            contact = _b.sent();
                            if (!contact) return [3 /*break*/, 9];
                            payload = log.notificationType === 'CUSTOMER_ACKNOWLEDGMENT'
                                ? this.emailComposition.composeContactCustomerAcknowledgment(contact)
                                : this.emailComposition.composeContactInternalAlert(contact);
                            return [4 /*yield*/, this.prisma.notificationDeliveryLog.update({
                                    where: { id: log.id },
                                    data: { failureReason: 'Retried manually (new log created)' },
                                })];
                        case 8:
                            _b.sent();
                            this.emailDelivery
                                .deliver(log.notificationType, contact.referenceCode, 'CONTACT', payload)
                                .catch(function (e) { return console.error(e); });
                            return [2 /*return*/, { success: true, message: 'Retry initiated' }];
                        case 9: return [3 /*break*/, 11];
                        case 10: throw new common_1.BadRequestException('Automatic retry not supported for this entity type yet');
                        case 11: throw new common_1.NotFoundException('Origin entity not found for retry reconstruction');
                    }
                });
            });
        };
        return NotificationsService_1;
    }());
    __setFunctionName(_classThis, "NotificationsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NotificationsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return NotificationsService = _classThis;
}();
exports.NotificationsService = NotificationsService;
