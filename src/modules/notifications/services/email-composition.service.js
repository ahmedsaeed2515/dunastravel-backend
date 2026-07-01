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
exports.EmailCompositionService = void 0;
var common_1 = require("@nestjs/common");
var inquiry_customer_acknowledgment_template_1 = require("../templates/inquiry-customer-acknowledgment.template");
var inquiry_internal_alert_template_1 = require("../templates/inquiry-internal-alert.template");
var contact_customer_acknowledgment_template_1 = require("../templates/contact-customer-acknowledgment.template");
var contact_internal_alert_template_1 = require("../templates/contact-internal-alert.template");
var EmailCompositionService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var EmailCompositionService = _classThis = /** @class */ (function () {
        function EmailCompositionService_1(configService) {
            this.configService = configService;
            this.logger = new common_1.Logger(EmailCompositionService.name);
            this.internalSalesEmail =
                this.configService.get('mail.internalAlertRecipient') ||
                    'sales@dunastravel.com';
            this.adminDashboardUrl =
                this.configService.get('mail.adminDashboardBaseUrl') ||
                    'http://localhost:3000/admin';
        }
        EmailCompositionService_1.prototype.composeInquiryCustomerAcknowledgment = function (payload) {
            this.validateInquiryPayload(payload);
            var template = (0, inquiry_customer_acknowledgment_template_1.renderInquiryCustomerAcknowledgment)({
                customerName: payload.fullName,
                referenceCode: payload.referenceCode,
                destinations: payload.destinations,
                travelDateRange: "".concat(payload.startDate || 'TBD', " - ").concat(payload.endDate || 'TBD'),
                numberOfTravelers: payload.adults + payload.children,
                submittedAt: new Date(payload.createdAt),
            });
            return {
                to: payload.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                tags: { notificationType: 'INQUIRY_CUSTOMER_ACK' },
            };
        };
        EmailCompositionService_1.prototype.composeInquiryInternalAlert = function (payload) {
            this.validateInquiryPayload(payload);
            var template = (0, inquiry_internal_alert_template_1.renderInquiryInternalAlert)({
                customerName: payload.fullName,
                customerEmail: payload.email,
                customerPhone: payload.phone,
                referenceCode: payload.referenceCode,
                destinations: payload.destinations,
                travelDateRange: "".concat(payload.startDate || 'TBD', " - ").concat(payload.endDate || 'TBD'),
                numberOfTravelers: payload.adults + payload.children,
                specialRequests: payload.notes || undefined,
                submittedAt: new Date(payload.createdAt),
                adminDashboardUrl: this.adminDashboardUrl,
            });
            return {
                to: this.internalSalesEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
                tags: { notificationType: 'INQUIRY_INTERNAL_ALERT' },
            };
        };
        EmailCompositionService_1.prototype.composeContactCustomerAcknowledgment = function (payload) {
            this.validateContactPayload(payload);
            var template = (0, contact_customer_acknowledgment_template_1.renderContactCustomerAcknowledgment)({
                customerName: "".concat(payload.firstName, " ").concat(payload.lastName),
                subject: payload.subject,
                submittedAt: payload.submittedAt,
            });
            return {
                to: payload.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                tags: { notificationType: 'CONTACT_CUSTOMER_ACK' },
            };
        };
        EmailCompositionService_1.prototype.composeContactInternalAlert = function (payload) {
            this.validateContactPayload(payload);
            var template = (0, contact_internal_alert_template_1.renderContactInternalAlert)({
                customerName: "".concat(payload.firstName, " ").concat(payload.lastName),
                customerEmail: payload.email,
                subject: payload.subject,
                message: payload.message,
                submittedAt: payload.submittedAt,
                adminDashboardUrl: this.adminDashboardUrl,
            });
            return {
                to: this.internalSalesEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
                tags: { notificationType: 'CONTACT_INTERNAL_ALERT' },
            };
        };
        EmailCompositionService_1.prototype.validateInquiryPayload = function (payload) {
            if (!payload || !payload.email || !payload.referenceCode) {
                this.logger.error('Invalid inquiry payload: Missing required fields');
                throw new Error('Incomplete inquiry payload');
            }
        };
        EmailCompositionService_1.prototype.validateContactPayload = function (payload) {
            if (!payload || !payload.email || !payload.subject) {
                this.logger.error('Invalid contact payload: Missing required fields');
                throw new Error('Incomplete contact payload');
            }
        };
        return EmailCompositionService_1;
    }());
    __setFunctionName(_classThis, "EmailCompositionService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        EmailCompositionService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return EmailCompositionService = _classThis;
}();
exports.EmailCompositionService = EmailCompositionService;
