import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';
import { InquiryCreatedPayload } from '../../inquiries/events/inquiry-events';
import { ContactCreatedEvent } from '../../contact-submissions/events/contact-created.event';
import { EmailPayload } from '../types/email-payload.type';
import { renderInquiryCustomerAcknowledgment } from '../templates/inquiry-customer-acknowledgment.template';
import { renderInquiryInternalAlert } from '../templates/inquiry-internal-alert.template';
import { renderContactCustomerAcknowledgment } from '../templates/contact-customer-acknowledgment.template';
import { renderContactInternalAlert } from '../templates/contact-internal-alert.template';
import {
  sanitizeEmailHtml,
  sanitizePlainText,
} from '../../../common/utils/content-sanitizer.util';

@Injectable()
export class EmailCompositionService {
  private readonly logger = new Logger(EmailCompositionService.name);
  private readonly internalSalesEmail: string;
  private readonly adminDashboardUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.internalSalesEmail =
      this.configService.get<string>('mail.internalAlertRecipient') ||
      'sales@dunastravel.com';
    this.adminDashboardUrl =
      this.configService.get<string>('mail.adminDashboardBaseUrl') ||
      'http://localhost:3000/admin';
  }

  async getTemplateFromDb(
    templateName: string,
    variables: Record<string, any>,
    fallbackRender: (vars: any) => any,
  ): Promise<{ subject: string; html: string; text: string }> {
    const cacheKey = `email_template:${templateName}`;
    let template = await this.cacheManager.get<any>(cacheKey);

    if (!template) {
      template = await this.prisma.emailTemplate.findUnique({
        where: { name: templateName },
      });
      if (template) {
        await this.cacheManager.set(cacheKey, template, 3600000); // 1 hour
      }
    }

    const safeVariables = Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [
        key,
        sanitizePlainText(String(value))
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 10_000),
      ]),
    );

    if (template) {
      let html = template.bodyHtml;
      let subject = template.subject;

      for (const [key, value] of Object.entries(safeVariables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, this.escapeHtml(value));
        subject = subject.replace(regex, value);
      }

      const safeHtml = sanitizeEmailHtml(html);
      return {
        subject: sanitizePlainText(subject)
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 255),
        html: safeHtml,
        text: sanitizePlainText(safeHtml).slice(0, 50_000),
      };
    }

    // Fallback to hardcoded template
    const fallback = fallbackRender(safeVariables);
    const safeHtml = sanitizeEmailHtml(fallback.html);
    return {
      subject: sanitizePlainText(fallback.subject)
        .replace(/[\r\n]+/g, ' ')
        .slice(0, 255),
      html: safeHtml,
      text: sanitizePlainText(fallback.text || safeHtml).slice(0, 50_000),
    };
  }

  async composeInquiryCustomerAcknowledgment(
    payload: InquiryCreatedPayload,
  ): Promise<EmailPayload> {
    this.validateInquiryPayload(payload);

    const variables = {
      customerName: payload.fullName,
      referenceCode: payload.referenceCode,
      destinations: payload.destinations.join(', '),
      travelDateRange: `${payload.startDate || 'TBD'} - ${payload.endDate || 'TBD'}`,
      numberOfTravelers: payload.adults + payload.children,
      submittedAt: new Date(payload.createdAt).toLocaleDateString(),
    };

    const template = await this.getTemplateFromDb(
      'inquiry_customer_ack',
      variables,
      renderInquiryCustomerAcknowledgment,
    );

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'INQUIRY_CUSTOMER_ACK' },
    };
  }

  async composeInquiryInternalAlert(
    payload: InquiryCreatedPayload,
  ): Promise<EmailPayload> {
    this.validateInquiryPayload(payload);

    const variables = {
      customerName: payload.fullName,
      customerEmail: payload.email,
      customerPhone: payload.phone || 'N/A',
      referenceCode: payload.referenceCode,
      destinations: payload.destinations.join(', '),
      travelDateRange: `${payload.startDate || 'TBD'} - ${payload.endDate || 'TBD'}`,
      numberOfTravelers: payload.adults + payload.children,
      specialRequests: payload.notes || 'None',
      submittedAt: new Date(payload.createdAt).toLocaleDateString(),
      adminDashboardUrl: this.adminDashboardUrl,
    };

    const template = await this.getTemplateFromDb(
      'inquiry_internal_alert',
      variables,
      renderInquiryInternalAlert,
    );

    return {
      to: this.internalSalesEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'INQUIRY_INTERNAL_ALERT' },
    };
  }

  async composeContactCustomerAcknowledgment(
    payload: ContactCreatedEvent,
  ): Promise<EmailPayload> {
    this.validateContactPayload(payload);

    const variables = {
      customerName: `${payload.firstName} ${payload.lastName}`,
      subject: payload.subject,
      submittedAt: payload.submittedAt.toLocaleDateString(),
    };

    const template = await this.getTemplateFromDb(
      'contact_customer_ack',
      variables,
      renderContactCustomerAcknowledgment,
    );

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'CONTACT_CUSTOMER_ACK' },
    };
  }

  async composeContactInternalAlert(
    payload: ContactCreatedEvent,
  ): Promise<EmailPayload> {
    this.validateContactPayload(payload);

    const variables = {
      customerName: `${payload.firstName} ${payload.lastName}`,
      customerEmail: payload.email,
      subject: payload.subject,
      message: payload.message,
      submittedAt: payload.submittedAt.toLocaleDateString(),
      adminDashboardUrl: this.adminDashboardUrl,
    };

    const template = await this.getTemplateFromDb(
      'contact_internal_alert',
      variables,
      renderContactInternalAlert,
    );

    return {
      to: this.internalSalesEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'CONTACT_INTERNAL_ALERT' },
    };
  }

  async composePaymentConfirmedCustomer(payload: {
    customerEmail: string;
    customerName: string;
    referenceCode: string;
    tourTitle: string;
    amountUsd: number;
    paidAt: Date;
  }): Promise<EmailPayload> {
    const variables = {
      customerName: payload.customerName,
      referenceCode: payload.referenceCode,
      tourTitle: payload.tourTitle,
      amountUsd: payload.amountUsd.toFixed(2),
      paidAt: payload.paidAt.toLocaleDateString(),
    };

    const template = await this.getTemplateFromDb(
      'payment_confirmed_customer',
      variables,
      (vars) => ({
        subject: `Payment Confirmed - Booking #${vars.referenceCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #061D5D; padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px; color: #C9A227;">Dunas Travel</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Payment Confirmation</p>
            </div>
            <div style="padding: 24px; color: #333333; line-height: 1.6;">
              <h2 style="color: #061D5D; margin-top: 0;">Payment Received!</h2>
              <p>Hi <strong>${vars.customerName}</strong>,</p>
              <p>We have successfully received your payment of <strong>$${vars.amountUsd} USD</strong> for booking <strong>#${vars.referenceCode}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9;">
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Booking Ref:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.referenceCode}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Tour:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.tourTitle}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">$${vars.amountUsd} USD</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Date Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.paidAt}</td></tr>
              </table>
              <p>Thank you for choosing Dunas Travel. We look forward to creating an unforgettable journey for you.</p>
            </div>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #666;">
              &copy; Dunas Travel. All rights reserved.
            </div>
          </div>
        `,
        text: `Hi ${vars.customerName},\n\nWe have received your payment of $${vars.amountUsd} USD for booking #${vars.referenceCode} (${vars.tourTitle}).\nThank you for choosing Dunas Travel!`,
      }),
    );

    return {
      to: payload.customerEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'PAYMENT_CONFIRMED_CUSTOMER' },
    };
  }

  async composePaymentConfirmedAdmin(payload: {
    customerName: string;
    customerEmail: string;
    referenceCode: string;
    tourTitle: string;
    amountUsd: number;
    paidAt: Date;
  }): Promise<EmailPayload> {
    const variables = {
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      referenceCode: payload.referenceCode,
      tourTitle: payload.tourTitle,
      amountUsd: payload.amountUsd.toFixed(2),
      paidAt: payload.paidAt.toLocaleDateString(),
      adminDashboardUrl: this.adminDashboardUrl,
    };

    const template = await this.getTemplateFromDb(
      'payment_confirmed_admin',
      variables,
      (vars) => ({
        subject: `[PAYMENT] Booking #${vars.referenceCode} Paid - $${vars.amountUsd}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #061D5D; padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px; color: #C9A227;">Dunas Travel Admin Alert</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px;">New Payment Confirmed</p>
            </div>
            <div style="padding: 24px; color: #333333; line-height: 1.6;">
              <h2 style="color: #27ae60; margin-top: 0;">New Payment Received</h2>
              <p>A new payment of <strong>$${vars.amountUsd} USD</strong> has been confirmed for booking <strong>#${vars.referenceCode}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9;">
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Booking Ref:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.referenceCode}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.customerName} (${vars.customerEmail})</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Tour:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.tourTitle}</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">$${vars.amountUsd} USD</td></tr>
                <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Date Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${vars.paidAt}</td></tr>
              </table>
              <p><a href="${vars.adminDashboardUrl}/bookings" style="display: inline-block; background-color: #061D5D; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Dashboard</a></p>
            </div>
          </div>
        `,
        text: `New Payment Received for booking #${vars.referenceCode} from ${vars.customerName} ($${vars.amountUsd} USD).`,
      }),
    );

    return {
      to: this.internalSalesEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'PAYMENT_CONFIRMED_ADMIN' },
    };
  }

  private validateInquiryPayload(payload: InquiryCreatedPayload) {
    if (!payload || !payload.email || !payload.referenceCode) {
      this.logger.error('Invalid inquiry payload: Missing required fields');
      throw new Error('Incomplete inquiry payload');
    }
  }

  private validateContactPayload(payload: ContactCreatedEvent) {
    if (!payload || !payload.email || !payload.subject) {
      this.logger.error('Invalid contact payload: Missing required fields');
      throw new Error('Incomplete contact payload');
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character]!,
    );
  }
}
