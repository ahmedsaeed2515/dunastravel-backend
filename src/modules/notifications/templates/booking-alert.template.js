"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBookingInternalAlert = renderBookingInternalAlert;
var template_types_1 = require("./template.types");
function renderBookingInternalAlert(data, internalRecipient, adminDashboardUrl) {
    var safeName = (0, template_types_1.escapeHtml)(data.customerName);
    var safeEmail = (0, template_types_1.escapeHtml)(data.customerEmail);
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
    var safeAdminUrl = (0, template_types_1.escapeHtml)("".concat(adminDashboardUrl, "/bookings/").concat(data.referenceCode));
    return {
        to: internalRecipient,
        subject: "NEW BOOKING: ".concat(safeTourTitle, " (Ref: ").concat(data.referenceCode, ")"),
        text: "New Booking Received!\n\nReference: ".concat(data.referenceCode, "\nTour: ").concat(safeTourTitle, "\nCustomer: ").concat(safeName, " (").concat(safeEmail, ")\nTravel Date: ").concat(safeDate, "\nPassengers: ").concat(totalPassengers, "\nTotal Price: ").concat(safeTotal, "\n\nView details: ").concat(safeAdminUrl),
        html: "\n      <!DOCTYPE html>\n      <html lang=\"en\">\n      <head>\n        <meta charset=\"UTF-8\">\n        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n        <title>New Booking Alert</title>\n        <style>\n          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333; line-height: 1.5; margin: 0; padding: 20px; }\n          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border-top: 4px solid #2ecc71; }\n          .header h2 { color: #2ecc71; margin-top: 0; }\n          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }\n          .details-table th, .details-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }\n          .details-table th { width: 40%; color: #666; }\n          .action-btn { display: inline-block; background: #2ecc71; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-top: 15px; }\n        </style>\n      </head>\n      <body>\n        <div class=\"container\">\n          <div class=\"header\">\n            <h2>New Booking Received</h2>\n            <p>A new tour booking has been confirmed.</p>\n          </div>\n          \n          <table class=\"details-table\">\n            <tr>\n              <th>Reference Code</th>\n              <td><strong>".concat(data.referenceCode, "</strong></td>\n            </tr>\n            <tr>\n              <th>Invoice Number</th>\n              <td>").concat(data.invoiceNumber, "</td>\n            </tr>\n            <tr>\n              <th>Tour</th>\n              <td>").concat(safeTourTitle, "</td>\n            </tr>\n            <tr>\n              <th>Travel Date</th>\n              <td>").concat(safeDate, "</td>\n            </tr>\n            <tr>\n              <th>Passengers</th>\n              <td>").concat(totalPassengers, " (Adults: ").concat(data.adults, ", Children: ").concat(data.children, ", Infants: ").concat(data.infants, ")</td>\n            </tr>\n            <tr>\n              <th>Total Price</th>\n              <td><strong>").concat(safeTotal, "</strong></td>\n            </tr>\n            <tr>\n              <th>Customer Name</th>\n              <td>").concat(safeName, "</td>\n            </tr>\n            <tr>\n              <th>Customer Email</th>\n              <td><a href=\"mailto:").concat(safeEmail, "\">").concat(safeEmail, "</a></td>\n            </tr>\n          </table>\n          \n          <a href=\"").concat(safeAdminUrl, "\" class=\"action-btn\">View in Admin Dashboard</a>\n        </div>\n      </body>\n      </html>\n    "),
    };
}
