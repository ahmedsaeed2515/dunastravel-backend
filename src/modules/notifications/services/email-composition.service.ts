import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../../prisma/prisma.service';
import { InquiryCreatedPayload } from '../../inquiries/events/inquiry-events';
import { ContactCreatedEvent } from '../../contact-submissions/events/contact-created.event';
import { EmailPayload } from '../types/email-payload.type';
import { TemplateRegistryService } from '../templates/template-registry.service';
import {
  EmailEventType,
  SupportedLocale,
} from '../types/canonical-notification.types';
import {
  formatFinancialAmount,
  formatMultiCurrencySummary,
} from '../../../common/utils/currency-formatter.util';
import {
  sanitizeEmailHtml,
  sanitizePlainText,
} from '../../../common/utils/content-sanitizer.util';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmailCompositionService {
  private readonly logger = new Logger(EmailCompositionService.name);
  private readonly internalSalesEmail: string;
  private readonly internalSupportEmail: string;
  private readonly internalPaymentsEmail: string;
  private readonly adminDashboardUrl: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly templateRegistry: TemplateRegistryService,
  ) {
    this.internalSalesEmail =
      this.configService.get<string>('mail.salesEmail') ||
      process.env.SALES_EMAIL ||
      this.configService.get<string>('mail.internalAlertRecipient') ||
      process.env.MAIL_INTERNAL_ALERT_RECIPIENT ||
      'booking.online@dunas-travel.com';
    this.internalSupportEmail =
      this.configService.get<string>('mail.supportAlertEmail') ||
      process.env.SUPPORT_ALERT_EMAIL ||
      this.internalSalesEmail;
    this.internalPaymentsEmail =
      this.configService.get<string>('mail.paymentsAlertEmail') ||
      process.env.PAYMENTS_ALERT_EMAIL ||
      this.internalSalesEmail;
    this.adminDashboardUrl =
      this.configService.get<string>('mail.adminDashboardBaseUrl') ||
      process.env.ADMIN_URL ||
      'https://admin.dunas-travel.com';
  }

  getTemplateRegistry(): TemplateRegistryService {
    return this.templateRegistry;
  }

  async getTemplateFromDb(
    templateName: string,
    variables: Record<string, any>,
    fallbackRender: (vars: any) => any,
  ): Promise<{ subject: string; html: string; text: string }> {
    const cacheKey = `email_template:${templateName}`;
    let template = await this.cacheManager.get<any>(cacheKey);

    if (!template && this.prisma?.emailTemplate) {
      try {
        template = await this.prisma.emailTemplate.findUnique({
          where: { name: templateName },
        });
        if (template) {
          await this.cacheManager.set(cacheKey, template, 3600000); // 1 hour
        }
      } catch (_e) {
        // Safe fallback
      }
    }

    const safeVariables = Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [
        key,
        sanitizePlainText(String(value ?? ''))
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

    // Fallback to template render
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
    locale: SupportedLocale = 'en',
  ): Promise<EmailPayload> {
    this.validateInquiryPayload(payload);

    const rendered = this.templateRegistry.renderTemplate(
      EmailEventType.INQUIRY_CREATED,
      locale,
      {
        customerName: payload.fullName,
        referenceCode: payload.referenceCode,
        destinations: Array.isArray(payload.destinations)
          ? payload.destinations.join(', ')
          : 'Egypt & Middle East',
      },
    );

    return {
      to: payload.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: rendered.locale,
      tags: { notificationType: 'INQUIRY_CUSTOMER_ACK' },
    };
  }

  async composeInquiryInternalAlert(
    payload: InquiryCreatedPayload,
  ): Promise<EmailPayload> {
    this.validateInquiryPayload(payload);

    const rendered = this.templateRegistry.renderTemplate(
      EmailEventType.ADMIN_ASSIGNMENT,
      'en',
      {
        assigneeName: 'Sales Concierge Team',
        entityType: 'Tailor-Made Inquiry',
        referenceCode: payload.referenceCode,
        dashboardUrl: `${this.adminDashboardUrl}/inquiries`,
      },
    );

    return {
      to: this.internalSalesEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: 'en',
      tags: { notificationType: 'INQUIRY_INTERNAL_ALERT' },
    };
  }

  async composeContactCustomerAcknowledgment(
    payload: ContactCreatedEvent,
    locale: SupportedLocale = 'en',
  ): Promise<EmailPayload> {
    this.validateContactPayload(payload);

    const rendered = this.templateRegistry.renderTemplate(
      EmailEventType.CONTACT_SUBMITTED,
      locale,
      {
        customerName: `${payload.firstName} ${payload.lastName}`,
        referenceCode: payload.referenceCode,
        subject: payload.subject,
      },
    );

    return {
      to: payload.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: rendered.locale,
      tags: { notificationType: 'CONTACT_CUSTOMER_ACK' },
    };
  }

  async composeContactInternalAlert(
    payload: ContactCreatedEvent,
  ): Promise<EmailPayload> {
    this.validateContactPayload(payload);

    const rendered = this.templateRegistry.renderTemplate(
      EmailEventType.ADMIN_ASSIGNMENT,
      'en',
      {
        assigneeName: 'Inbound Inquiries Desk',
        entityType: 'Contact Submission',
        referenceCode: payload.referenceCode,
        dashboardUrl: `${this.adminDashboardUrl}/contact-submissions`,
      },
    );

    return {
      to: this.internalSupportEmail,
      subject: `[CONTACT ALERT] New message from ${payload.firstName} ${payload.lastName} (Ref: ${payload.referenceCode})`,
      html: rendered.html,
      text: rendered.text,
      locale: 'en',
      tags: { notificationType: 'CONTACT_INTERNAL_ALERT' },
    };
  }

  async composePaymentConfirmedCustomer(payload: {
    customerEmail: string;
    customerName: string;
    referenceCode: string;
    tourTitle: string;
    amount?: number | Prisma.Decimal;
    amountUsd?: number | Prisma.Decimal;
    currency?: string;
    originalAmount?: number | Prisma.Decimal | null;
    originalCurrency?: string | null;
    exchangeRate?: number | Prisma.Decimal | null;
    paidAt: Date;
    invoiceNumber?: string;
    transactionId?: string;
    locale?: SupportedLocale;
  }): Promise<EmailPayload> {
    const locale = payload.locale || 'en';
    const currency = (payload.currency || 'USD').toUpperCase();
    const effectiveAmount = payload.amount ?? payload.amountUsd ?? 0;

    const formattedAmount = formatFinancialAmount(
      effectiveAmount,
      currency,
      locale,
    );
    const usdEquivalent =
      currency !== 'USD' && payload.amountUsd && Number(payload.amountUsd) > 0
        ? formatFinancialAmount(payload.amountUsd, 'USD', locale)
        : undefined;

    const rendered = this.templateRegistry.renderTemplate(
      EmailEventType.PAYMENT_SUCCEEDED,
      locale,
      {
        customerName: payload.customerName,
        referenceCode: payload.referenceCode,
        tourTitle: payload.tourTitle,
        formattedAmount,
        transactionId: payload.transactionId || `TXN-${payload.referenceCode}`,
        verifiedAt: payload.paidAt.toUTCString(),
        invoiceNumber: payload.invoiceNumber || '',
        currency,
        usdEquivalent: usdEquivalent || '',
        exchangeRate: payload.exchangeRate ? String(payload.exchangeRate) : '',
      },
    );

    return {
      to: payload.customerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      locale: rendered.locale,
      tags: { notificationType: 'PAYMENT_CONFIRMED_CUSTOMER' },
    };
  }

  async composePaymentConfirmedAdmin(payload: {
    customerName: string;
    customerEmail: string;
    referenceCode: string;
    tourTitle: string;
    amount?: number | Prisma.Decimal;
    amountUsd?: number | Prisma.Decimal;
    currency?: string;
    paidAt: Date;
    invoiceNumber?: string;
    transactionId?: string;
  }): Promise<EmailPayload> {
    const currency = (payload.currency || 'USD').toUpperCase();
    const effectiveAmount = payload.amount ?? payload.amountUsd ?? 0;
    const formattedAmount = formatFinancialAmount(
      effectiveAmount,
      currency,
      'en',
    );

    const subject = `[PAYMENT] Booking #${payload.referenceCode} Paid - ${formattedAmount}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #07060a; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px; color: #c9a227;">Dunas Travel Admin Alert</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Verified Payment Confirmed</p>
        </div>
        <div style="padding: 24px; color: #333333; line-height: 1.6;">
          <h2 style="color: #27ae60; margin-top: 0;">Payment Verified (GetPayIn)</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9f9f9;">
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Booking Ref:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${payload.referenceCode}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${payload.customerName} (${payload.customerEmail})</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Tour:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${payload.tourTitle}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${formattedAmount}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Date Paid:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">${payload.paidAt.toISOString()}</td></tr>
          </table>
          <p><a href="${this.adminDashboardUrl}/bookings" style="display: inline-block; background-color: #07060a; color: #c9a227; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Admin Dashboard</a></p>
        </div>
      </div>
    `;

    return {
      to: this.internalSalesEmail,
      subject,
      html,
      text: `Payment Received for booking #${payload.referenceCode} from ${payload.customerName} (${formattedAmount}).`,
      locale: 'en',
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
