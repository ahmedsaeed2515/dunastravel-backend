"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactCreatedEvent = exports.CONTACT_CREATED_EVENT = void 0;
exports.CONTACT_CREATED_EVENT = 'contact.created';
var ContactCreatedEvent = /** @class */ (function () {
    function ContactCreatedEvent(payload) {
        this.referenceCode = payload.referenceCode;
        this.firstName = payload.firstName;
        this.lastName = payload.lastName;
        this.email = payload.email;
        this.phone = payload.phone;
        this.subject = payload.subject;
        this.message = payload.message;
        this.locale = payload.locale;
        this.submittedAt = payload.submittedAt;
    }
    return ContactCreatedEvent;
}());
exports.ContactCreatedEvent = ContactCreatedEvent;
