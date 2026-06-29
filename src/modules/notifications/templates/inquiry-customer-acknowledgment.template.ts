import {
  IEmailTemplate,
  InquiryAcknowledgmentTemplateData,
  escapeHtml,
} from './template.types';

export function renderInquiryCustomerAcknowledgment(
  data: InquiryAcknowledgmentTemplateData,
): IEmailTemplate {
  const safeName = escapeHtml(data.customerName);
  const safeDests = data.destinations.map(escapeHtml).join(', ');
  const safeDates = escapeHtml(data.travelDateRange);

  return {
    subject: `We've received your inquiry! (Ref: ${data.referenceCode})`,
    text: `Hi ${safeName},\n\nThank you for reaching out to Dunas Travel. We have successfully received your tailor-made tour request (Ref: ${data.referenceCode}).\n\nDestinations: ${safeDests}\nDates: ${safeDates}\nTravelers: ${data.numberOfTravelers}\n\nOur travel experts are reviewing your details and will get back to you shortly.\n\nWarm regards,\nThe Dunas Travel Team`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dunas Travel - Inquiry Received</title>
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
            <p>Thank you for reaching out to Dunas Travel. We have successfully received your tailor-made tour request.</p>
            
            <div class="details-box">
              <p><strong>Reference Code:</strong> ${data.referenceCode}</p>
              <p><strong>Destinations:</strong> ${safeDests}</p>
              <p><strong>Travel Dates:</strong> ${safeDates}</p>
              <p><strong>Travelers:</strong> ${data.numberOfTravelers}</p>
            </div>
            
            <p>Our travel experts are meticulously reviewing your details to craft the perfect itinerary. We will be in touch with you very soon with a personalized proposal.</p>
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
