import {
  IEmailTemplate,
  ContactInternalAlertTemplateData,
  escapeHtml,
} from './template.types';

export function renderContactInternalAlert(
  data: ContactInternalAlertTemplateData,
): IEmailTemplate {
  const safeName = escapeHtml(data.customerName);
  const safeEmail = escapeHtml(data.customerEmail);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br>');

  return {
    subject: `[NEW MESSAGE] ${safeSubject} - ${safeName}`,
    text: `New Contact Form Submission\n\nName: ${safeName}\nEmail: ${safeEmail}\nSubject: ${safeSubject}\n\nMessage:\n${data.message}\n\nReview Dashboard: ${data.adminDashboardUrl}/contact-submissions`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Message Alert</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8; color: #212b36; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background-color: #2d3748; color: #fff; padding: 20px; text-align: center; }
          .header h2 { margin: 0; font-size: 20px; }
          .content { padding: 30px; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .data-table th, .data-table td { text-align: left; padding: 10px; border-bottom: 1px solid #dfe3e8; }
          .data-table th { width: 30%; color: #637381; font-weight: 500; font-size: 14px; }
          .data-table td { font-weight: 600; font-size: 14px; }
          .message-box { background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 15px; font-size: 14px; line-height: 1.5; color: #4b5563; }
          .action { text-align: center; margin-top: 30px; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #3182ce; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Contact Form Submission</h2>
          </div>
          <div class="content">
            <table class="data-table">
              <tr><th>Customer Name</th><td>${safeName}</td></tr>
              <tr><th>Email</th><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
              <tr><th>Subject</th><td>${safeSubject}</td></tr>
            </table>
            
            <p style="color: #637381; font-weight: 500; font-size: 14px; margin-bottom: 5px;">Message Content:</p>
            <div class="message-box">
              ${safeMessage}
            </div>
            
            <div class="action">
              <a href="${data.adminDashboardUrl}/contact-submissions" class="btn">View in Dashboard</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}
