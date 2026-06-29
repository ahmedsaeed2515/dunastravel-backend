import {
  IEmailTemplate,
  ContactAcknowledgmentTemplateData,
  escapeHtml,
} from './template.types';

export function renderContactCustomerAcknowledgment(
  data: ContactAcknowledgmentTemplateData,
): IEmailTemplate {
  const safeName = escapeHtml(data.customerName);
  const safeSubject = escapeHtml(data.subject);

  return {
    subject: `We've received your message: ${safeSubject}`,
    text: `Hi ${safeName},\n\nThank you for reaching out to Dunas Travel. We have successfully received your message regarding "${safeSubject}".\n\nOur team is reviewing your message and will respond as soon as possible, typically within 24 hours.\n\nWarm regards,\nThe Dunas Travel Team`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dunas Travel - Message Received</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; color: #333; line-height: 1.6; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e1b382; padding-bottom: 15px; }
          .header h1 { color: #e1b382; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
          .content { font-size: 16px; color: #444; }
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
            <p>Thank you for reaching out to Dunas Travel. We have successfully received your message regarding <em>"${safeSubject}"</em>.</p>
            <p>Our dedicated team is reviewing your message and will respond as soon as possible, typically within 24 hours.</p>
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
