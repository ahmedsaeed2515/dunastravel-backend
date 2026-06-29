import { EmailPayload } from '../types/email-payload.type';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import { escapeHtml } from './template.types';

export function renderBookingInternalAlert(
  data: BookingCreatedPayload,
  internalRecipient: string,
  adminDashboardUrl: string,
): EmailPayload {
  const safeName = escapeHtml(data.customerName);
  const safeEmail = escapeHtml(data.customerEmail);
  const safeTourTitle = escapeHtml(data.tourTitle);
  const travelDate =
    data.arrivalDate instanceof Date
      ? data.arrivalDate
      : new Date(data.arrivalDate);
  const safeDate = escapeHtml(
    travelDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  );
  const safeTotal = escapeHtml(`$${data.totalAmountUsd}`);
  const totalPassengers = data.adults + data.children + data.infants;
  const safeAdminUrl = escapeHtml(
    `${adminDashboardUrl}/bookings/${data.referenceCode}`,
  );

  return {
    to: internalRecipient,
    subject: `NEW BOOKING: ${safeTourTitle} (Ref: ${data.referenceCode})`,
    text: `New Booking Received!\n\nReference: ${data.referenceCode}\nTour: ${safeTourTitle}\nCustomer: ${safeName} (${safeEmail})\nTravel Date: ${safeDate}\nPassengers: ${totalPassengers}\nTotal Price: ${safeTotal}\n\nView details: ${safeAdminUrl}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Alert</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4; color: #333; line-height: 1.5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border-top: 4px solid #2ecc71; }
          .header h2 { color: #2ecc71; margin-top: 0; }
          .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .details-table th, .details-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
          .details-table th { width: 40%; color: #666; }
          .action-btn { display: inline-block; background: #2ecc71; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Booking Received</h2>
            <p>A new tour booking has been confirmed.</p>
          </div>
          
          <table class="details-table">
            <tr>
              <th>Reference Code</th>
              <td><strong>${data.referenceCode}</strong></td>
            </tr>
            <tr>
              <th>Invoice Number</th>
              <td>${data.invoiceNumber}</td>
            </tr>
            <tr>
              <th>Tour</th>
              <td>${safeTourTitle}</td>
            </tr>
            <tr>
              <th>Travel Date</th>
              <td>${safeDate}</td>
            </tr>
            <tr>
              <th>Passengers</th>
              <td>${totalPassengers} (Adults: ${data.adults}, Children: ${data.children}, Infants: ${data.infants})</td>
            </tr>
            <tr>
              <th>Total Price</th>
              <td><strong>${safeTotal}</strong></td>
            </tr>
            <tr>
              <th>Customer Name</th>
              <td>${safeName}</td>
            </tr>
            <tr>
              <th>Customer Email</th>
              <td><a href="mailto:${safeEmail}">${safeEmail}</a></td>
            </tr>
          </table>
          
          <a href="${safeAdminUrl}" class="action-btn">View in Admin Dashboard</a>
        </div>
      </body>
      </html>
    `,
  };
}
