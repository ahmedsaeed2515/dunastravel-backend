"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDeliveryStatus = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    NotificationType["CUSTOMER_ACKNOWLEDGMENT"] = "CUSTOMER_ACKNOWLEDGMENT";
    NotificationType["INTERNAL_SALES_ALERT"] = "INTERNAL_SALES_ALERT";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationDeliveryStatus;
(function (NotificationDeliveryStatus) {
    NotificationDeliveryStatus["PENDING"] = "PENDING";
    NotificationDeliveryStatus["SENT"] = "SENT";
    NotificationDeliveryStatus["FAILED"] = "FAILED";
    NotificationDeliveryStatus["EXHAUSTED"] = "EXHAUSTED";
})(NotificationDeliveryStatus || (exports.NotificationDeliveryStatus = NotificationDeliveryStatus = {}));
