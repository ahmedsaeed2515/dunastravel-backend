"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBookingCustomerConfirmation = renderBookingCustomerConfirmation;
var template_types_1 = require("./template.types");
function renderBookingCustomerConfirmation(data) {
    var safeName = (0, template_types_1.escapeHtml)(data.customerName);
    var safeTourTitle = (0, template_types_1.escapeHtml)(data.tourTitle);
    var travelDate = data.arrivalDate instanceof Date
        ? data.arrivalDate
        : new Date(data.arrivalDate);
    var safeDate = (0, template_types_1.escapeHtml)(travelDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }));
    var safeTotal = (0, template_types_1.escapeHtml)("$".concat(data.totalAmountUsd));
    var totalPassengers = data.adults + data.children + data.infants;
    return {
        to: data.customerEmail,
        subject: "Booking Confirmation: ".concat(safeTourTitle, " (Ref: ").concat(data.referenceCode, ")"),
        text: "Hi ".concat(safeName, ",\n\nYour booking for ").concat(safeTourTitle, " is confirmed! (Ref: ").concat(data.referenceCode, ").\n\nTravel Date: ").concat(safeDate, "\nPassengers: ").concat(totalPassengers, "\nTotal Price: ").concat(safeTotal, "\n\nThank you for choosing Dunas Travel. We will contact you soon with further details.\n\nWarm regards,\nThe Dunas Travel Team"),
        html: "\n      <!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>Dunas Travel - Booking Confirmation</title>\n        <style>\n          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #333; line-height: 1.6; margin: 0; padding: 20px; }\n          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }\n          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e1b382; padding-bottom: 15px; }\n          .header h1 { color: #e1b382; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }\n          .content { font-size: 16px; color: #444; }\n          .details-box { background-color: #fef8f3; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #f2e3d5; }\n          .details-box p { margin: 5px 0; }\n          .details-box strong { color: #555; }\n          .footer { text-align: center; font-size: 14px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }\n        </style>\n      </head>\n      <body>\n        <div class=\"container\">\n          <div class=\"header\">\n            <h1>Dunas Travel</h1>\n          </div>\n          <div class=\"content\">\n            <p>Dear <strong>".concat(safeName, "</strong>,</p>\n            <p>Your booking for <strong>").concat(safeTourTitle, "</strong> is officially confirmed.</p>\n            \n            <div class=\"details-box\">\n              <p><strong>Reference Code:</strong> ").concat(data.referenceCode, "</p>\n              <p><strong>Invoice Number:</strong> ").concat(data.invoiceNumber, "</p>\n              <p><strong>Travel Date:</strong> ").concat(safeDate, "</p>\n              <p><strong>Total Passengers:</strong> ").concat(totalPassengers, "</p>\n              <p><strong>Total Price:</strong> ").concat(safeTotal, "</p>\n            </div>\n            \n            <p>Thank you for choosing Dunas Travel. We will contact you shortly with further details and your complete itinerary.</p>\n            <p>Warm regards,<br><strong>The Dunas Travel Team</strong></p>\n          </div>\n          <div class=\"footer\">\n            <p>&copy; ").concat(new Date().getFullYear(), " Dunas Travel. All rights reserved.</p>\n          </div>\n        </div>\n      </body>\n      </html>\n    "),
    };
}
