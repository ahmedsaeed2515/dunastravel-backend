import {
  IEmailTemplate,
  InquiryInternalAlertTemplateData,
  escapeHtml,
} from './template.types';

export function renderInquiryInternalAlert(
  data: InquiryInternalAlertTemplateData,
): IEmailTemplate {
  const safeName = escapeHtml(data.customerName);
  const safeEmail = escapeHtml(data.customerEmail);
  const safePhone = escapeHtml(data.customerPhone || 'N/A');
  const destsArray = Array.isArray(data.destinations)
    ? data.destinations
    : typeof data.destinations === 'string'
      ? [data.destinations]
      : [];
  const safeDests = destsArray.map(escapeHtml).join(', ');
  const safeDates = escapeHtml(data.travelDateRange);
  const safeRequests = escapeHtml(data.specialRequests || 'None provided');

  return {
    subject: `[NEW INQUIRY] Ref: ${data.referenceCode} - ${safeName}`,
    text: `New Custom Tour Inquiry\n\nReference: ${data.referenceCode}\nName: ${safeName}\nEmail: ${safeEmail}\nPhone: ${safePhone}\n\nDestinations: ${safeDests}\nDates: ${safeDates}\nTravelers: ${data.numberOfTravelers}\nRequests: ${safeRequests}\n\nReview Dashboard: ${data.adminDashboardUrl}/inquiries/${data.referenceCode}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Inquiry Alert</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8; color: #212b36; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background-color: #1a202c; color: #fff; padding: 20px; text-align: center; }
          .header h2 { margin: 0; font-size: 20px; }
          .content { padding: 30px; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table th, .data-table td { text-align: left; padding: 10px; border-bottom: 1px solid #dfe3e8; }
          .data-table th { width: 30%; color: #637381; font-weight: 500; font-size: 14px; }
          .data-table td { font-weight: 600; font-size: 14px; }
          .action { text-align: center; margin-top: 30px; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #3182ce; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Tailor-Made Inquiry</h2>
          </div>
          <div class="content">
            <table class="data-table">
              <tr><th>Reference</th><td>${data.referenceCode}</td></tr>
              <tr><th>Customer Name</th><td>${safeName}</td></tr>
              <tr><th>Email</th><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              <tr><th>Phone</th><td>${safePhone}</td></tr>
              <tr><th>Destinations</th><td>${safeDests}</td></tr>
              <tr><th>Dates</th><td>${safeDates}</td></tr>
              <tr><th>Travelers</th><td>${data.numberOfTravelers}</td></tr>
              <tr><th>Requests</th><td>${safeRequests}</td></tr>
            </table>
            
            <div class="action">
              <a href="${data.adminDashboardUrl}/inquiries/${data.referenceCode}" class="btn">View in Dashboard</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}
