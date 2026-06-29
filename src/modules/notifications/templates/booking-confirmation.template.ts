import { EmailPayload } from '../types/email-payload.type';
import { BookingCreatedPayload } from '../interfaces/booking-created-payload.interface';
import { escapeHtml } from './template.types';

export function renderBookingCustomerConfirmation(
  data: BookingCreatedPayload,
): EmailPayload {
  const safeName = escapeHtml(data.customerName);
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

  return {
    to: data.customerEmail,
    subject: `Booking Confirmation: ${safeTourTitle} (Ref: ${data.referenceCode})`,
    text: `Hi ${safeName},\n\nYour booking for ${safeTourTitle} is confirmed! (Ref: ${data.referenceCode}).\n\nTravel Date: ${safeDate}\nPassengers: ${totalPassengers}\nTotal Price: ${safeTotal}\n\nThank you for choosing Dunas Travel. We will contact you soon with further details.\n\nWarm regards,\nThe Dunas Travel Team`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dunas Travel - Booking Confirmation</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #333; line-height: 1.6; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e1b382; padding-bottom: 15px; }
          .header h1 { color: #e1b382; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
          .content { font-size: 16px; color: #444; }
          .details-box { background-color: #fef8f3; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #f2e3d5; }
          .details-box p { margin: 5px 0; }
          .details-box strong { color: #555; }
          .footer { text-align: center; font-size: 14px; color: #888; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Dunas Travel</h1>
          </div>
          <div class="content">
            <p>Dear <strong>${safeName}</strong>,</p>
            <p>Your booking for <strong>${safeTourTitle}</strong> is officially confirmed.</p>
            
            <div class="details-box">
              <p><strong>Reference Code:</strong> ${data.referenceCode}</p>
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Travel Date:</strong> ${safeDate}</p>
              <p><strong>Total Passengers:</strong> ${totalPassengers}</p>
              <p><strong>Total Price:</strong> ${safeTotal}</p>
            </div>
            
            <p>Thank you for choosing Dunas Travel. We will contact you shortly with further details and your complete itinerary.</p>
            <p>Warm regards,<br><strong>The Dunas Travel Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Dunas Travel. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}
