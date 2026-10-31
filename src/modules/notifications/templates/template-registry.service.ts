import { Injectable, BadRequestException } from '@nestjs/common';
import {
  EmailEventType,
  SupportedLocale,
  SUPPORTED_LOCALES,
} from '../types/canonical-notification.types';
import {
  sanitizeEmailHtml,
  sanitizePlainText,
} from '../../../common/utils/content-sanitizer.util';

export interface TemplateDefinition {
  eventType: EmailEventType;
  version: number;
  hasUnsubscribe: boolean;
  requiredVariables: string[];
  allowedVariables: string[];
  previewFixture: Record<string, any>;
  render: (
    locale: SupportedLocale,
    vars: Record<string, any>,
  ) => { subject: string; html: string; text: string };
}

export class TemplateValidationException extends BadRequestException {
  constructor(message: string) {
    super(`Template Validation Error: ${message}`);
  }
}

@Injectable()
export class TemplateRegistryService {
  private readonly templates = new Map<EmailEventType, TemplateDefinition>();
  private readonly approvedOrigins: string[] = [
    'https://dunas-travel.com',
    'https://dunastravel.com',
    'https://www.dunastravel.com',
    'https://admin.dunastravel.com',
    'https://www.dunas-travel.com',
    'https://admin.dunas-travel.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4000',
  ];

  constructor() {
    this.registerAllTemplates();
  }

  getApprovedOrigins(): string[] {
    const frontendUrl = process.env.FRONTEND_URL;
    const adminUrl =
      process.env.ADMIN_URL || process.env.MAIL_ADMIN_DASHBOARD_BASE_URL;
    const origins = [...this.approvedOrigins];
    if (frontendUrl && !origins.includes(frontendUrl))
      origins.push(frontendUrl);
    if (adminUrl && !origins.includes(adminUrl)) origins.push(adminUrl);
    return origins;
  }

  getTemplate(eventType: EmailEventType): TemplateDefinition {
    const tpl = this.templates.get(eventType);
    if (!tpl) {
      throw new TemplateValidationException(
        `Template for event type '${eventType}' is not registered.`,
      );
    }
    return tpl;
  }

  getAllRegisteredEvents(): EmailEventType[] {
    return Array.from(this.templates.keys());
  }

  render(
    eventType: EmailEventType,
    locale: string = 'en',
    variables?: Record<string, any>,
  ): { subject: string; html: string; text: string; locale: SupportedLocale } {
    const tpl = this.getTemplate(eventType);
    const vars = variables || tpl.previewFixture;
    return this.renderTemplate(eventType, locale, vars);
  }

  renderTemplate(
    eventType: EmailEventType,
    locale: string = 'en',
    variables: Record<string, any>,
  ): { subject: string; html: string; text: string; locale: SupportedLocale } {
    const normalizedLocale: SupportedLocale = SUPPORTED_LOCALES.includes(
      locale as SupportedLocale,
    )
      ? (locale as SupportedLocale)
      : 'en';

    const tpl = this.getTemplate(eventType);

    // 1. Validate required variables
    for (const reqVar of tpl.requiredVariables) {
      if (
        variables[reqVar] === undefined ||
        variables[reqVar] === null ||
        variables[reqVar] === ''
      ) {
        throw new TemplateValidationException(
          `Missing required variable '${reqVar}' for template '${eventType}'.`,
        );
      }
    }

    // 2. Validate unknown variables if allowedVariables defined
    if (tpl.allowedVariables.length > 0) {
      for (const key of Object.keys(variables)) {
        if (!tpl.allowedVariables.includes(key)) {
          throw new TemplateValidationException(
            `Unknown variable '${key}' is forbidden for template '${eventType}'.`,
          );
        }
      }
    }

    // 3. Render subject, html, text
    const rendered = tpl.render(normalizedLocale, variables);

    // 4. Validate subject has NO CRLF injection
    if (/[\r\n]/.test(rendered.subject)) {
      throw new TemplateValidationException(
        `Subject contains illegal CRLF characters in template '${eventType}'.`,
      );
    }

    // 5. Check for unresolved {{placeholders}}
    const unresolvedMatch =
      rendered.html.match(/\{\{([a-zA-Z0-9_]+)\}\}/) ||
      rendered.subject.match(/\{\{([a-zA-Z0-9_]+)\}\}/);
    if (unresolvedMatch) {
      throw new TemplateValidationException(
        `Unresolved placeholder '${unresolvedMatch[0]}' remains in rendered output for '${eventType}'.`,
      );
    }

    // 6. Validate link origins in HTML
    this.validateLinks(rendered.html, eventType);

    // 7. Sanitize HTML
    const sanitizedHtml = sanitizeEmailHtml(rendered.html);

    return {
      subject: rendered.subject,
      html: sanitizedHtml,
      text: rendered.text,
      locale: normalizedLocale,
    };
  }

  private validateLinks(html: string, eventType: EmailEventType): void {
    const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi);
    const approved = this.getApprovedOrigins();

    for (const match of hrefMatches) {
      const url = match[1].trim();
      if (url.startsWith('mailto:') || url.startsWith('tel:')) {
        continue;
      }
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new TemplateValidationException(
            `Unapproved link protocol '${parsed.protocol}' in template '${eventType}'.`,
          );
        }
        const origin = parsed.origin;
        const isApproved = approved.some(
          (appr) =>
            origin === appr ||
            origin.endsWith('.dunas-travel.com') ||
            origin.endsWith('.dunastravel.com') ||
            origin === 'https://dunas-travel.com' ||
            origin === 'https://dunastravel.com' ||
            origin === 'http://localhost:3000' ||
            origin === 'http://localhost:3001',
        );
        if (!isApproved) {
          throw new TemplateValidationException(
            `Unapproved link origin '${origin}' in template '${eventType}'.`,
          );
        }
      } catch (err: any) {
        if (err instanceof TemplateValidationException) throw err;
        throw new TemplateValidationException(
          `Invalid link URL '${url}' in template '${eventType}'.`,
        );
      }
    }
  }

  private registerAllTemplates() {
    // Register all 35 templates
    const events = Object.values(EmailEventType);
    for (const event of events) {
      this.templates.set(event, this.createTemplateDefinition(event));
    }
  }

  private createTemplateDefinition(
    eventType: EmailEventType,
  ): TemplateDefinition {
    switch (eventType) {
      case EmailEventType.USER_REGISTRATION:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['name', 'email'],
          allowedVariables: ['name', 'email', 'loginUrl'],
          previewFixture: {
            name: 'Sophia Laurent',
            email: 'sophia@example.com',
            loginUrl: 'https://dunas-travel.com/login',
          },
          render: (locale, vars) => this.renderAuthWelcome(locale, vars),
        };

      case EmailEventType.EMAIL_VERIFICATION:
      case EmailEventType.VERIFICATION_RESEND:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['name', 'otpCode', 'verifyUrl'],
          allowedVariables: ['name', 'otpCode', 'verifyUrl', 'email'],
          previewFixture: {
            name: 'Alexander Wright',
            otpCode: '582914',
            verifyUrl: 'https://dunas-travel.com/verify-email?code=582914',
            email: 'alex@example.com',
          },
          render: (locale, vars) => this.renderEmailVerification(locale, vars),
        };

      case EmailEventType.PASSWORD_RESET_REQUEST:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['name', 'resetUrl'],
          allowedVariables: ['name', 'resetUrl', 'email'],
          previewFixture: {
            name: 'Elena Rostova',
            resetUrl:
              'https://dunas-travel.com/reset-password?token=mocktoken123',
            email: 'elena@example.com',
          },
          render: (locale, vars) => this.renderPasswordReset(locale, vars),
        };

      case EmailEventType.PASSWORD_RESET_COMPLETION:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['name', 'timestamp'],
          allowedVariables: ['name', 'timestamp', 'email'],
          previewFixture: {
            name: 'Elena Rostova',
            timestamp: new Date().toISOString(),
            email: 'elena@example.com',
          },
          render: (locale, vars) =>
            this.renderPasswordResetCompletion(locale, vars),
        };

      case EmailEventType.BOOKING_CREATED:
      case EmailEventType.BOOKING_PAYMENT_REQUIRED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'travelDate',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'travelDate',
            'passengers',
            'paymentUrl',
            'currency',
          ],
          previewFixture: {
            customerName: 'Marcus Aurelius',
            referenceCode: 'BK-DUNAS-901',
            tourTitle: 'Luxury Nile Cruise & Pyramids',
            formattedAmount: '$3,450.00 USD',
            travelDate: 'October 15, 2026',
            passengers: '2 Adults',
            paymentUrl: 'https://dunas-travel.com/checkout/BK-DUNAS-901',
            currency: 'USD',
          },
          render: (locale, vars) => this.renderBookingCreated(locale, vars),
        };

      case EmailEventType.FREE_BOOKING_CREATED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'travelDate',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'travelDate',
            'passengers',
          ],
          previewFixture: {
            customerName: 'Claire Bennet',
            referenceCode: 'BK-FREE-100',
            tourTitle: 'Cairo Cultural Walk (Complimentary)',
            travelDate: 'November 1, 2026',
            passengers: '1 Adult',
          },
          render: (locale, vars) => this.renderFreeBooking(locale, vars),
        };

      case EmailEventType.BOOKING_CONFIRMED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'travelDate',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'travelDate',
            'invoiceNumber',
            'passengers',
            'currency',
          ],
          previewFixture: {
            customerName: 'Marcus Aurelius',
            referenceCode: 'BK-DUNAS-901',
            tourTitle: 'Luxury Nile Cruise & Pyramids',
            formattedAmount: '3.150,00 € EUR',
            travelDate: 'October 15, 2026',
            invoiceNumber: 'INV-2026-901',
            passengers: '2 Adults',
            currency: 'EUR',
          },
          render: (locale, vars) => this.renderBookingConfirmed(locale, vars),
        };

      case EmailEventType.BOOKING_PARTIALLY_PAID:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedPaidAmount',
            'formattedRemainingAmount',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedPaidAmount',
            'formattedRemainingAmount',
            'dueDate',
            'paymentUrl',
          ],
          previewFixture: {
            customerName: 'Marcus Aurelius',
            referenceCode: 'BK-DUNAS-901',
            tourTitle: 'Luxury Nile Cruise & Pyramids',
            formattedPaidAmount: '$1,000.00 USD',
            formattedRemainingAmount: '$2,450.00 USD',
            dueDate: 'September 15, 2026',
            paymentUrl: 'https://dunas-travel.com/checkout/BK-DUNAS-901',
          },
          render: (locale, vars) =>
            this.renderBookingPartiallyPaid(locale, vars),
        };

      case EmailEventType.PAYMENT_SUCCEEDED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'transactionId',
            'verifiedAt',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'transactionId',
            'verifiedAt',
            'invoiceNumber',
            'currency',
            'usdEquivalent',
            'exchangeRate',
          ],
          previewFixture: {
            customerName: 'Victoria Sterling',
            referenceCode: 'BK-7729',
            tourTitle: 'Private Red Sea Oasis Retreat',
            formattedAmount: '2.400,00 € EUR',
            transactionId: 'TXN-GETPAYIN-98124',
            verifiedAt: 'October 31, 2026 18:00 UTC',
            invoiceNumber: 'INV-2026-88',
            currency: 'EUR',
            usdEquivalent: '$2,592.00 USD',
            exchangeRate: '1.080000',
          },
          render: (locale, vars) => this.renderPaymentSucceeded(locale, vars),
        };

      case EmailEventType.PAYMENT_FAILED:
      case EmailEventType.PAYMENT_EXPIRED:
      case EmailEventType.PAYMENT_RETRY:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'retryUrl',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedAmount',
            'retryUrl',
            'safeReason',
          ],
          previewFixture: {
            customerName: 'Victoria Sterling',
            referenceCode: 'BK-7729',
            tourTitle: 'Private Red Sea Oasis Retreat',
            formattedAmount: '$2,500.00 USD',
            retryUrl: 'https://dunas-travel.com/checkout/BK-7729',
            safeReason: 'Card transaction was declined by issuing institution.',
          },
          render: (locale, vars) =>
            this.renderPaymentFailedOrExpired(locale, vars),
        };

      case EmailEventType.REFUND_COMPLETED:
      case EmailEventType.PARTIAL_REFUND_COMPLETED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'formattedRefundAmount',
            'refundReference',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'formattedRefundAmount',
            'refundReference',
            'refundReason',
            'formattedRemainingBalance',
          ],
          previewFixture: {
            customerName: 'Julian Croft',
            referenceCode: 'BK-5520',
            tourTitle: 'Alexandria Coastal Expedition',
            formattedRefundAmount: '850,00 € EUR',
            refundReference: 'REF-GETPAYIN-3391',
            refundReason: 'Customer itinerary modification agreement',
            formattedRemainingBalance: '0,00 € EUR',
          },
          render: (locale, vars) => this.renderRefundCompleted(locale, vars),
        };

      case EmailEventType.BOOKING_CANCELLED_BEFORE_PAYMENT:
      case EmailEventType.BOOKING_CANCELLED_AFTER_PAYMENT:
      case EmailEventType.BOOKING_STATUS_CHANGED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'status',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'tourTitle',
            'status',
            'reason',
            'refundDetails',
          ],
          previewFixture: {
            customerName: 'Julian Croft',
            referenceCode: 'BK-5520',
            tourTitle: 'Alexandria Coastal Expedition',
            status: 'CANCELLED',
            reason: 'Requested by guest',
          },
          render: (locale, vars) =>
            this.renderBookingStatusChanged(locale, vars),
        };

      case EmailEventType.INVOICE_CREATED:
      case EmailEventType.INVOICE_PAID:
      case EmailEventType.INVOICE_VOIDED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'invoiceNumber',
            'referenceCode',
            'formattedTotal',
            'invoiceStatus',
          ],
          allowedVariables: [
            'customerName',
            'invoiceNumber',
            'referenceCode',
            'formattedTotal',
            'invoiceStatus',
            'dueDate',
            'pdfUrl',
          ],
          previewFixture: {
            customerName: 'Julian Croft',
            invoiceNumber: 'INV-2026-5520',
            referenceCode: 'BK-5520',
            formattedTotal: '$2,100.00 USD',
            invoiceStatus: 'PAID',
          },
          render: (locale, vars) => this.renderInvoiceEvent(locale, vars),
        };

      case EmailEventType.INQUIRY_CREATED:
      case EmailEventType.INQUIRY_ASSIGNED:
      case EmailEventType.INQUIRY_STATUS_CHANGED:
      case EmailEventType.INQUIRY_CONVERTED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['customerName', 'referenceCode'],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'destinations',
            'travelDates',
            'travelers',
            'assignedAgent',
            'inquiryStatus',
          ],
          previewFixture: {
            customerName: 'Lord Sterling',
            referenceCode: 'INQ-DUNAS-441',
            destinations: 'Luxor, Aswan, Cairo',
            travelDates: 'Dec 2026',
            travelers: '2 Travelers',
          },
          render: (locale, vars) => this.renderInquiryEvent(locale, vars),
        };

      case EmailEventType.CONTACT_SUBMITTED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['customerName', 'referenceCode', 'subject'],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'subject',
            'message',
          ],
          previewFixture: {
            customerName: 'Lady Catherine',
            referenceCode: 'CNT-991',
            subject: 'VIP Helicopter Transfer Inquiry',
          },
          render: (locale, vars) => this.renderContactSubmitted(locale, vars),
        };

      case EmailEventType.REVIEW_SUBMITTED:
      case EmailEventType.REVIEW_MODERATED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['reviewerName', 'tourTitle'],
          allowedVariables: [
            'reviewerName',
            'tourTitle',
            'rating',
            'moderationStatus',
          ],
          previewFixture: {
            reviewerName: 'Baron von Miller',
            tourTitle: 'Royal Cairo & Pyramids Journey',
            rating: '5',
            moderationStatus: 'APPROVED',
          },
          render: (locale, vars) => this.renderReviewEvent(locale, vars),
        };

      case EmailEventType.ADMIN_ASSIGNMENT:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'assigneeName',
            'entityType',
            'referenceCode',
            'dashboardUrl',
          ],
          allowedVariables: [
            'assigneeName',
            'entityType',
            'referenceCode',
            'dashboardUrl',
          ],
          previewFixture: {
            assigneeName: 'Ahmed Concierge',
            entityType: 'Tailor-Made Inquiry',
            referenceCode: 'INQ-DUNAS-441',
            dashboardUrl: 'https://admin.dunas-travel.com/inquiries',
          },
          render: (locale, vars) => this.renderAdminAssignment(locale, vars),
        };

      case EmailEventType.COMMISSION_UPDATED:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'partnerName',
            'referenceCode',
            'formattedCommission',
            'status',
          ],
          allowedVariables: [
            'partnerName',
            'referenceCode',
            'formattedCommission',
            'status',
          ],
          previewFixture: {
            partnerName: 'Iberia VIP Travel Agency',
            referenceCode: 'COMM-8821',
            formattedCommission: '450,00 € EUR',
            status: 'APPROVED',
          },
          render: (locale, vars) => this.renderCommissionUpdated(locale, vars),
        };

      case EmailEventType.WALLET_TRANSACTION:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'accountName',
            'transactionType',
            'formattedAmount',
            'formattedBalance',
          ],
          allowedVariables: [
            'accountName',
            'transactionType',
            'formattedAmount',
            'formattedBalance',
            'reference',
          ],
          previewFixture: {
            accountName: 'Prestige Travel Partners',
            transactionType: 'CREDIT',
            formattedAmount: '$1,200.00 USD',
            formattedBalance: '$5,800.00 USD',
            reference: 'WAL-TX-701',
          },
          render: (locale, vars) => this.renderWalletTransaction(locale, vars),
        };

      case EmailEventType.CUSTOMER_DOCUMENT_UPDATE:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: [
            'customerName',
            'referenceCode',
            'documentTitle',
            'documentUrl',
          ],
          allowedVariables: [
            'customerName',
            'referenceCode',
            'documentTitle',
            'documentUrl',
          ],
          previewFixture: {
            customerName: 'Marcus Aurelius',
            referenceCode: 'BK-DUNAS-901',
            documentTitle: 'Voucher & Flight Schedule',
            documentUrl: 'https://dunas-travel.com/account/documents',
          },
          render: (locale, vars) =>
            this.renderCustomerDocumentUpdate(locale, vars),
        };

      case EmailEventType.SYSTEM_INCIDENT:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['customerName', 'incidentSummary', 'actionTaken'],
          allowedVariables: [
            'customerName',
            'incidentSummary',
            'actionTaken',
            'referenceCode',
          ],
          previewFixture: {
            customerName: 'Valued Guest',
            incidentSummary: 'Temporary gateway settlement delay resolved.',
            actionTaken:
              'Your transaction has been re-verified and confirmed without penalty.',
            referenceCode: 'TXN-9011',
          },
          render: (locale, vars) => this.renderSystemIncident(locale, vars),
        };

      case EmailEventType.MARKETING_CAMPAIGN:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: true,
          requiredVariables: ['title', 'content', 'unsubscribeUrl'],
          allowedVariables: [
            'title',
            'content',
            'unsubscribeUrl',
            'customerName',
          ],
          previewFixture: {
            title: 'Unveiling 2027 Private Yacht Expeditions on the Nile',
            content:
              'Experience Egypt like never before with our bespoke private journeys.',
            unsubscribeUrl:
              'https://dunas-travel.com/unsubscribe?token=mockunsub',
            customerName: 'Sophia Laurent',
          },
          render: (locale, vars) => this.renderMarketingCampaign(locale, vars),
        };

      default:
        return {
          eventType,
          version: 1,
          hasUnsubscribe: false,
          requiredVariables: ['title', 'message'],
          allowedVariables: ['title', 'message'],
          previewFixture: {
            title: 'Notification',
            message: 'Update from Dunas Travel.',
          },
          render: (locale, vars) => this.renderGenericNotice(locale, vars),
        };
    }
  }

  // ==========================================
  // TEMPLATE RENDER IMPLEMENTATIONS (5 Locales)
  // ==========================================

  private getBaseLayout(locale: SupportedLocale, contentHtml: string): string {
    const isAr = locale === 'ar';
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const font = isAr
      ? "'Segoe UI', Tahoma, Arial, sans-serif"
      : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #07060a; font-family: ${font}; color: #f5edd6; text-align: ${align}; }
    .card { max-width: 580px; margin: 30px auto; background-color: #121018; border: 1px solid rgba(201, 162, 39, 0.35); border-radius: 16px; overflow: hidden; box-shadow: 0 15px 50px rgba(0, 0, 0, 0.85); }
    .gold-bar { height: 4px; background: linear-gradient(90deg, #996515, #c9a227, #f7e7a0, #c9a227, #996515); }
    .brand { padding: 30px 25px 15px 25px; text-align: center; }
    .brand-title { font-family: 'Georgia', serif; font-size: 22px; font-weight: 700; letter-spacing: 4px; color: #c9a227; text-transform: uppercase; }
    .brand-sub { font-size: 10px; letter-spacing: 2px; color: #8e8777; text-transform: uppercase; margin-top: 4px; }
    .content { padding: 15px 30px 30px 30px; font-size: 14.5px; line-height: 1.65; color: #d1cbbd; text-align: ${align}; }
    .box { background-color: #1a1724; border: 1px solid rgba(201, 162, 39, 0.3); border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
    .footer { padding: 20px 25px; background-color: #0d0c13; border-top: 1px solid rgba(201, 162, 39, 0.15); text-align: center; font-size: 11px; color: #6e675b; }
    a { color: #c9a227; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="gold-bar"></div>
    <div class="brand">
      <div class="brand-title">DUNAS TRAVEL</div>
      <div class="brand-sub">Luxury Journeys & Bespoke Experiences</div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <div>Dunas Travel Group • Headquarters Cairo</div>
      <div style="margin-top: 6px;">Spain • Italy • Brazil • Mexico • Colombia • Egypt</div>
      <div style="margin-top: 8px;">
        <a href="https://dunas-travel.com">www.dunas-travel.com</a> | <a href="mailto:concierge@dunas-travel.com">concierge@dunas-travel.com</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private renderAuthWelcome(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.name);
    const loginUrl = vars.loginUrl || 'https://dunas-travel.com/login';

    const subjects: Record<SupportedLocale, string> = {
      en: `Welcome to Dunas Travel, ${name}`,
      ar: `مرحباً بك في دوناس ترافيل، ${name}`,
      es: `Bienvenido a Dunas Travel, ${name}`,
      pt: `Bem-vindo à Dunas Travel, ${name}`,
      it: `Benvenuto in Dunas Travel, ${name}`,
    };

    const greetings: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Welcome to Extraordinary Travel</h2><p>Dear ${name}, thank you for registering with Dunas Travel. Your portal for bespoke luxury itineraries across Egypt and the Middle East is now ready.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Access Your Account</a></p>`,
      ar: `<h2 style="color: #f7e7a0;">أهلاً بك في عالم السفر الفاخر</h2><p>عزيزنا ${name}، نشكرك على انضمامك إلى دوناس ترافيل. حسابك الخاص لاستكشاف وحجز أرقى الرحلات والتجارب السياحية في مصر والشرق الأوسط أصبح جاهزاً.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">تسجيل الدخول إلى حسابك</a></p>`,
      es: `<h2 style="color: #f7e7a0;">Bienvenido a Viajes Extraordinarios</h2><p>Estimado/a ${name}, gracias por registrarse en Dunas Travel. Su portal para itinerarios de lujo a medida en Egipto y Oriente Medio está listo.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Acceder a su Cuenta</a></p>`,
      pt: `<h2 style="color: #f7e7a0;">Bem-vindo a Viagens Extraordinárias</h2><p>Prezado/a ${name}, obrigado por se registrar na Dunas Travel. Seu portal exclusivo para roteiros de luxo no Egito e Oriente Médio está pronto.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Acessar sua Conta</a></p>`,
      it: `<h2 style="color: #f7e7a0;">Benvenuto nei Viaggi Straordinari</h2><p>Gentile ${name}, grazie per esserti registrato con Dunas Travel. Il tuo portale per viaggi di lusso su misura in Egitto e Medio Oriente è ora attivo.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Accedi al tuo Account</a></p>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, greetings[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nWelcome to Dunas Travel. Login at: ${loginUrl}\n\nwww.dunas-travel.com`;

    return { subject, html, text };
  }

  private renderEmailVerification(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.name);
    const code = sanitizePlainText(vars.otpCode);
    const verifyUrl = vars.verifyUrl;

    const subjects: Record<SupportedLocale, string> = {
      en: `${code} is your Dunas Travel verification code`,
      ar: `${code} هو رمز التحقق الخاص بك في دوناس ترافيل`,
      es: `${code} es su código de verificación de Dunas Travel`,
      pt: `${code} é o seu código de verificação Dunas Travel`,
      it: `${code} è il tuo codice di verifica Dunas Travel`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Verify Your Email Address</h2><p>Dear ${name}, please enter the code below to verify your account:</p><div class="box" style="text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#f7e7a0;">${code}</div><p style="text-align:center;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Verify Instantly</a></p><p style="font-size:12px;color:#8e8777;">Valid for 15 minutes. Never share this code with anyone.</p>`,
      ar: `<h2 style="color: #f7e7a0;">تأكيد البريد الإلكتروني</h2><p>عزيزنا ${name}، يرجى إدخال رمز التحقق التالي لتفعيل حسابك:</p><div class="box" style="text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#f7e7a0;">${code}</div><p style="text-align:center;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">تفعيل الحساب بنقرة واحدة</a></p><p style="font-size:12px;color:#8e8777;">صالح لمدة 15 دقيقة. لا تشارك هذا الرمز مع أي شخص.</p>`,
      es: `<h2 style="color: #f7e7a0;">Verifique su Correo Electrónico</h2><p>Estimado/a ${name}, introduzca el siguiente código para verificar su cuenta:</p><div class="box" style="text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#f7e7a0;">${code}</div><p style="text-align:center;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Verificar Ahora</a></p><p style="font-size:12px;color:#8e8777;">Válido durante 15 minutos. No comparta este código con nadie.</p>`,
      pt: `<h2 style="color: #f7e7a0;">Verifique seu E-mail</h2><p>Prezado/a ${name}, use o código abaixo para validar sua conta:</p><div class="box" style="text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#f7e7a0;">${code}</div><p style="text-align:center;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Verificar Agora</a></p><p style="font-size:12px;color:#8e8777;">Válido por 15 minutos. Nunca compartilhe este código.</p>`,
      it: `<h2 style="color: #f7e7a0;">Verifica il tuo Indirizzo Email</h2><p>Gentile ${name}, inserisci il seguente codice per verificare il tuo account:</p><div class="box" style="text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#f7e7a0;">${code}</div><p style="text-align:center;"><a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Verifica Ora</a></p><p style="font-size:12px;color:#8e8777;">Valido per 15 minuti. Non condividere questo codice.</p>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nCode: ${code}\nLink: ${verifyUrl}\nValid for 15 minutes.`;

    return { subject, html, text };
  }

  private renderPasswordReset(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.name);
    const resetUrl = vars.resetUrl;

    const subjects: Record<SupportedLocale, string> = {
      en: 'Reset your Dunas Travel password',
      ar: 'إعادة تعيين كلمة مرور دوناس ترافيل',
      es: 'Restablecer su contraseña de Dunas Travel',
      pt: 'Redefinir sua senha da Dunas Travel',
      it: 'Reimposta la tua password Dunas Travel',
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Password Reset Request</h2><p>Dear ${name}, we received a request to reset your password. Click below to select a new secure password:</p><p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Reset Password</a></p><p style="font-size:12px;color:#8e8777;">Valid for 1 hour. If you did not request this, you can safely ignore this email.</p>`,
      ar: `<h2 style="color: #f7e7a0;">طلب إعادة تعيين كلمة المرور</h2><p>عزيزنا ${name}، تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك. يرجى النقر على الرابط أدناه لإنشاء كلمة مرور جديدة:</p><p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">إعادة تعيين كلمة المرور</a></p><p style="font-size:12px;color:#8e8777;">الرابط صالح لمدة ساعة واحدة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان.</p>`,
      es: `<h2 style="color: #f7e7a0;">Restablecimiento de Contraseña</h2><p>Estimado/a ${name}, recibimos una solicitud para restablecer su contraseña. Haga clic a continuación para definir una nueva contraseña:</p><p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Restablecer Contraseña</a></p><p style="font-size:12px;color:#8e8777;">Válido durante 1 hora. Si no lo solicitó, ignore este correo.</p>`,
      pt: `<h2 style="color: #f7e7a0;">Redefinição de Senha</h2><p>Prezado/a ${name}, recebemos um pedido para redefinir sua senha. Clique abaixo para cadastrar uma nova senha segura:</p><p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Redefinir Senha</a></p><p style="font-size:12px;color:#8e8777;">Válido por 1 hora. Caso não tenha solicitado, desconsidere este e-mail.</p>`,
      it: `<h2 style="color: #f7e7a0;">Reimpostazione Password</h2><p>Gentile ${name}, abbiamo ricevuto una richiesta di reimpostazione della tua password. Clicca qui sotto per impostarne una nuova:</p><p style="text-align:center;"><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Reimposta Password</a></p><p style="font-size:12px;color:#8e8777;">Valido per 1 ora. Se non hai richiesto tu il ripristino, ignora questo messaggio.</p>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nReset link: ${resetUrl}\nValid for 1 hour.`;

    return { subject, html, text };
  }

  private renderPasswordResetCompletion(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.name);
    const ts = sanitizePlainText(vars.timestamp);

    const subjects: Record<SupportedLocale, string> = {
      en: 'Security Alert: Your Dunas Travel password was changed',
      ar: 'تنبيه أمني: تم تغيير كلمة المرور لحسابك في دوناس ترافيل',
      es: 'Alerta de Seguridad: Se cambió su contraseña de Dunas Travel',
      pt: 'Alerta de Segurança: Sua senha da Dunas Travel foi alterada',
      it: 'Avviso di Sicurezza: La tua password Dunas Travel è stata modificata',
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Password Successfully Changed</h2><p>Dear ${name}, the password for your Dunas Travel account was successfully updated on ${ts}.</p><p style="color:#e74c3c;">If you did not make this change, please contact our security team immediately at concierge@dunas-travel.com.</p>`,
      ar: `<h2 style="color: #f7e7a0;">تم تغيير كلمة المرور بنجاح</h2><p>عزيزنا ${name}، نود إعلامك بأنه تم تحديث كلمة المرور الخاصة بحسابك بنجاح في ${ts}.</p><p style="color:#e74c3c;">إذا لم تقم بهذا الإجراء، يرجى التواصل فوراً مع فريق الأمان عبر concierge@dunas-travel.com.</p>`,
      es: `<h2 style="color: #f7e7a0;">Contraseña Modificada con Éxito</h2><p>Estimado/a ${name}, la contraseña de su cuenta ha sido actualizada el ${ts}.</p><p style="color:#e74c3c;">Si no autorizó este cambio, contáctenos de inmediato en concierge@dunas-travel.com.</p>`,
      pt: `<h2 style="color: #f7e7a0;">Senha Alterada com Sucesso</h2><p>Prezado/a ${name}, a senha da sua conta foi atualizada com sucesso em ${ts}.</p><p style="color:#e74c3c;">Se você não realizou esta alteração, avise imediatamente nossa equipe em concierge@dunas-travel.com.</p>`,
      it: `<h2 style="color: #f7e7a0;">Password Modificata con Successo</h2><p>Gentile ${name}, la password del tuo account è stata aggiornata in data ${ts}.</p><p style="color:#e74c3c;">Se non sei stato tu ad eseguire l'operazione, contatta immediatamente concierge@dunas-travel.com.</p>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name}, your password was changed on ${ts}.`;

    return { subject, html, text };
  }

  private renderBookingCreated(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const amount = sanitizePlainText(vars.formattedAmount);
    const date = sanitizePlainText(vars.travelDate);
    const payUrl = vars.paymentUrl;

    const subjects: Record<SupportedLocale, string> = {
      en: `Booking Received: ${tour} (Ref: ${ref})`,
      ar: `تم استلام طلب الحجز: ${tour} (المرجع: ${ref})`,
      es: `Reserva Recibida: ${tour} (Ref: ${ref})`,
      pt: `Reserva Recebida: ${tour} (Ref: ${ref})`,
      it: `Prenotazione Ricevuta: ${tour} (Rif: ${ref})`,
    };

    const payButton = payUrl
      ? `<p style="text-align:center;"><a href="${payUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Complete Payment</a></p>`
      : '';

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Booking Request Received</h2><p>Dear ${name}, your reservation request has been received and is awaiting payment.</p><div class="box"><div><strong>Reference:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Date:</strong> ${date}</div><div><strong>Amount Due:</strong> ${amount}</div></div>${payButton}`,
      ar: `<h2 style="color: #f7e7a0;">تم استلام طلب الحجز الخاص بك</h2><p>عزيزنا ${name}، تم استلام طلب الحجز وهو في انتظار السداد لإتمامه وتأكيده نهائياً.</p><div class="box"><div><strong>رقم الحجز:</strong> ${ref}</div><div><strong>الرحلة:</strong> ${tour}</div><div><strong>تاريخ السفر:</strong> ${date}</div><div><strong>المبلغ المستحق:</strong> ${amount}</div></div>${payButton}`,
      es: `<h2 style="color: #f7e7a0;">Solicitud de Reserva Recibida</h2><p>Estimado/a ${name}, su solicitud de reserva ha sido recibida y está pendiente de pago.</p><div class="box"><div><strong>Referencia:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Fecha:</strong> ${date}</div><div><strong>Total a pagar:</strong> ${amount}</div></div>${payButton}`,
      pt: `<h2 style="color: #f7e7a0;">Pedido de Reserva Recebido</h2><p>Prezado/a ${name}, recebemos sua solicitação de reserva, aguardando confirmação de pagamento.</p><div class="box"><div><strong>Referência:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Data:</strong> ${date}</div><div><strong>Valor pendente:</strong> ${amount}</div></div>${payButton}`,
      it: `<h2 style="color: #f7e7a0;">Richiesta di Prenotazione Ricevuta</h2><p>Gentile ${name}, la tua richiesta di prenotazione è stata ricevuta ed è in attesa di pagamento.</p><div class="box"><div><strong>Riferimento:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Data:</strong> ${date}</div><div><strong>Importo dovuto:</strong> ${amount}</div></div>${payButton}`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nRef: ${ref}\nTour: ${tour}\nAmount: ${amount}\nDate: ${date}\nPayment: ${payUrl || 'Pending'}`;

    return { subject, html, text };
  }

  private renderFreeBooking(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const date = sanitizePlainText(vars.travelDate);

    const subjects: Record<SupportedLocale, string> = {
      en: `Complimentary Booking Confirmed: ${tour} (Ref: ${ref})`,
      ar: `تأكيد الحجز المجاني: ${tour} (المرجع: ${ref})`,
      es: `Reserva de Cortesía Confirmada: ${tour} (Ref: ${ref})`,
      pt: `Reserva Cortesia Confirmada: ${tour} (Ref: ${ref})`,
      it: `Prenotazione Gratuita Confermata: ${tour} (Rif: ${ref})`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Complimentary Experience Confirmed</h2><p>Dear ${name}, your complimentary experience is fully confirmed. No payment is required.</p><div class="box"><div><strong>Reference:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Date:</strong> ${date}</div><div><strong>Cost:</strong> Free / Complimentary</div></div>`,
      ar: `<h2 style="color: #f7e7a0;">تأكيد الحجز المجاني الترحيبي</h2><p>عزيزنا ${name}، تم تأكيد حجز رحلتك المجانية الترحيبية بنجاح دون أي رسوم.</p><div class="box"><div><strong>رقم الحجز:</strong> ${ref}</div><div><strong>الرحلة:</strong> ${tour}</div><div><strong>تاريخ السفر:</strong> ${date}</div><div><strong>التكلفة:</strong> مجاني بالكامل</div></div>`,
      es: `<h2 style="color: #f7e7a0;">Experiencia de Cortesía Confirmada</h2><p>Estimado/a ${name}, su experiencia de cortesía está confirmada. No se requiere ningún pago.</p><div class="box"><div><strong>Referencia:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Fecha:</strong> ${date}</div><div><strong>Coste:</strong> Gratuito</div></div>`,
      pt: `<h2 style="color: #f7e7a0;">Experiência Cortesia Confirmada</h2><p>Prezado/a ${name}, sua experiência cortesia está confirmada. Nenhum pagamento é necessário.</p><div class="box"><div><strong>Referência:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Data:</strong> ${date}</div><div><strong>Custo:</strong> Gratuito</div></div>`,
      it: `<h2 style="color: #f7e7a0;">Esperienza Gratuita Confermata</h2><p>Gentile ${name}, la tua esperienza di cortesia è confermata. Nessun pagamento richiesto.</p><div class="box"><div><strong>Riferimento:</strong> ${ref}</div><div><strong>Tour:</strong> ${tour}</div><div><strong>Data:</strong> ${date}</div><div><strong>Costo:</strong> Gratuito</div></div>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nRef: ${ref}\nTour: ${tour}\nCost: Free\nDate: ${date}`;

    return { subject, html, text };
  }

  private renderBookingConfirmed(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const amount = sanitizePlainText(vars.formattedAmount);
    const date = sanitizePlainText(vars.travelDate);
    const inv = vars.invoiceNumber ? sanitizePlainText(vars.invoiceNumber) : '';

    const subjects: Record<SupportedLocale, string> = {
      en: `Booking Confirmed: ${tour} (Ref: ${ref})`,
      ar: `تم تأكيد حجزك: ${tour} (المرجع: ${ref})`,
      es: `Reserva Confirmada: ${tour} (Ref: ${ref})`,
      pt: `Reserva Confirmada: ${tour} (Ref: ${ref})`,
      it: `Prenotazione Confermata: ${tour} (Rif: ${ref})`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #27ae60;">Your Journey is Confirmed</h2><p>Dear ${name}, your booking for <strong>${tour}</strong> has been officially confirmed.</p><div class="box"><div><strong>Reference:</strong> ${ref}</div>${inv ? `<div><strong>Invoice:</strong> ${inv}</div>` : ''}<div><strong>Travel Date:</strong> ${date}</div><div><strong>Total Value:</strong> ${amount}</div></div><p>Our concierge team will contact you shortly with complete pre-departure documentation.</p>`,
      ar: `<h2 style="color: #27ae60;">تم تأكيد رحلتك رسمياً</h2><p>عزيزنا ${name}، تم تأكيد حجزك لرحلة <strong>${tour}</strong> بنجاح.</p><div class="box"><div><strong>رقم الحجز:</strong> ${ref}</div>${inv ? `<div><strong>الفاتورة:</strong> ${inv}</div>` : ''}<div><strong>تاريخ السفر:</strong> ${date}</div><div><strong>القيمة الإجمالية:</strong> ${amount}</div></div><p>سيتواصل معك فريق الاستقبال الخاص بنا لترتيب كافة مستندات وبرنامج السفر.</p>`,
      es: `<h2 style="color: #27ae60;">Su Viaje Está Confirmado</h2><p>Estimado/a ${name}, su reserva para <strong>${tour}</strong> está formalmente confirmada.</p><div class="box"><div><strong>Referencia:</strong> ${ref}</div>${inv ? `<div><strong>Factura:</strong> ${inv}</div>` : ''}<div><strong>Fecha:</strong> ${date}</div><div><strong>Importe:</strong> ${amount}</div></div>`,
      pt: `<h2 style="color: #27ae60;">Sua Viagem Está Confirmada</h2><p>Prezado/a ${name}, sua reserva para <strong>${tour}</strong> foi confirmada com sucesso.</p><div class="box"><div><strong>Referência:</strong> ${ref}</div>${inv ? `<div><strong>Fatura:</strong> ${inv}</div>` : ''}<div><strong>Data:</strong> ${date}</div><div><strong>Valor:</strong> ${amount}</div></div>`,
      it: `<h2 style="color: #27ae60;">Il Tuo Viaggio è Confermato</h2><p>Gentile ${name}, la tua prenotazione per <strong>${tour}</strong> è confermata.</p><div class="box"><div><strong>Riferimento:</strong> ${ref}</div>${inv ? `<div><strong>Fattura:</strong> ${inv}</div>` : ''}<div><strong>Data:</strong> ${date}</div><div><strong>Totale:</strong> ${amount}</div></div>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nRef: ${ref}\nTour: ${tour}\nDate: ${date}\nTotal: ${amount}`;

    return { subject, html, text };
  }

  private renderBookingPartiallyPaid(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const paid = sanitizePlainText(vars.formattedPaidAmount);
    const remaining = sanitizePlainText(vars.formattedRemainingAmount);

    const subjects: Record<SupportedLocale, string> = {
      en: `Partial Payment Received: ${tour} (Ref: ${ref})`,
      ar: `تم استلام الدفعة الجزئية: ${tour} (المرجع: ${ref})`,
      es: `Pago Parcial Recibido: ${tour} (Ref: ${ref})`,
      pt: `Pagamento Parcial Recebido: ${tour} (Ref: ${ref})`,
      it: `Pagamento Parziale Ricevuto: ${tour} (Rif: ${ref})`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Partial Payment Confirmed</h2><p>Dear ${name}, we have received your partial payment of <strong>${paid}</strong> for booking <strong>#${ref}</strong>.</p><div class="box"><div><strong>Amount Paid:</strong> ${paid}</div><div><strong>Remaining Balance:</strong> ${remaining}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      ar: `<h2 style="color: #f7e7a0;">تأكيد استلام دفعة جزئية</h2><p>عزيزنا ${name}، تم استلام دفعة جزئية قدرها <strong>${paid}</strong> لحجزك رقم <strong>#${ref}</strong>.</p><div class="box"><div><strong>المبلغ المدفوع:</strong> ${paid}</div><div><strong>المبلغ المتبقي:</strong> ${remaining}</div><div><strong>الرحلة:</strong> ${tour}</div></div>`,
      es: `<h2 style="color: #f7e7a0;">Pago Parcial Confirmado</h2><p>Estimado/a ${name}, hemos recibido su pago parcial de <strong>${paid}</strong> para la reserva <strong>#${ref}</strong>.</p><div class="box"><div><strong>Pagado:</strong> ${paid}</div><div><strong>Pendiente:</strong> ${remaining}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      pt: `<h2 style="color: #f7e7a0;">Pagamento Parcial Confirmado</h2><p>Prezado/a ${name}, recebemos seu pagamento parcial de <strong>${paid}</strong> para a reserva <strong>#${ref}</strong>.</p><div class="box"><div><strong>Valor Pago:</strong> ${paid}</div><div><strong>Saldo Restante:</strong> ${remaining}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      it: `<h2 style="color: #f7e7a0;">Pagamento Parziale Confermato</h2><p>Gentile ${name}, abbiamo ricevuto il tuo pagamento parziale di <strong>${paid}</strong> per la prenotazione <strong>#${ref}</strong>.</p><div class="box"><div><strong>Pagato:</strong> ${paid}</div><div><strong>Saldo Residuo:</strong> ${remaining}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nPaid: ${paid}\nRemaining: ${remaining}\nRef: ${ref}`;

    return { subject, html, text };
  }

  private renderPaymentSucceeded(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const amount = sanitizePlainText(vars.formattedAmount);
    const txn = sanitizePlainText(vars.transactionId);
    const verifiedAt = sanitizePlainText(vars.verifiedAt);
    const inv = vars.invoiceNumber ? sanitizePlainText(vars.invoiceNumber) : '';
    const usdEq = vars.usdEquivalent
      ? `<div><strong>USD Equivalent:</strong> ${sanitizePlainText(vars.usdEquivalent)}</div>`
      : '';

    const subjects: Record<SupportedLocale, string> = {
      en: `Payment Receipt: ${amount} for Booking #${ref}`,
      ar: `إيصال سداد: ${amount} للحجز رقم #${ref}`,
      es: `Recibo de Pago: ${amount} para Reserva #${ref}`,
      pt: `Recibo de Pagamento: ${amount} para Reserva #${ref}`,
      it: `Ricevuta di Pagamento: ${amount} per Prenotazione #${ref}`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #27ae60;">Payment Successfully Confirmed</h2><p>Dear ${name}, thank you for your payment. Your transaction has been verified through our secure payment gateway (GetPayIn).</p><div class="box"><div><strong>Booking Reference:</strong> ${ref}</div>${inv ? `<div><strong>Invoice Number:</strong> ${inv}</div>` : ''}<div><strong>Amount Paid:</strong> ${amount}</div>${usdEq}<div><strong>Transaction Ref:</strong> ${txn}</div><div><strong>Verified At:</strong> ${verifiedAt}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      ar: `<h2 style="color: #27ae60;">تم تأكيد السداد بنجاح</h2><p>عزيزنا ${name}، شكراً لك. تم التحقق من عملية السداد بنجاح عبر بوابة الدفع الآمنة (GetPayIn).</p><div class="box"><div><strong>رقم الحجز:</strong> ${ref}</div>${inv ? `<div><strong>رقم الفاتورة:</strong> ${inv}</div>` : ''}<div><strong>المبلغ المدفوع:</strong> ${amount}</div>${usdEq}<div><strong>مرجع المعاملة:</strong> ${txn}</div><div><strong>تاريخ التحقق:</strong> ${verifiedAt}</div><div><strong>الرحلة:</strong> ${tour}</div></div>`,
      es: `<h2 style="color: #27ae60;">Pago Confirmado con Éxito</h2><p>Estimado/a ${name}, gracias por su pago. Su transacción ha sido verificada correctamente.</p><div class="box"><div><strong>Referencia:</strong> ${ref}</div>${inv ? `<div><strong>Factura:</strong> ${inv}</div>` : ''}<div><strong>Total Pagado:</strong> ${amount}</div>${usdEq}<div><strong>Transacción:</strong> ${txn}</div><div><strong>Fecha:</strong> ${verifiedAt}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      pt: `<h2 style="color: #27ae60;">Pagamento Confirmado com Sucesso</h2><p>Prezado/a ${name}, obrigado pelo pagamento. Sua transação foi verificada com sucesso.</p><div class="box"><div><strong>Referência:</strong> ${ref}</div>${inv ? `<div><strong>Fatura:</strong> ${inv}</div>` : ''}<div><strong>Valor Pago:</strong> ${amount}</div>${usdEq}<div><strong>Transação:</strong> ${txn}</div><div><strong>Data:</strong> ${verifiedAt}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
      it: `<h2 style="color: #27ae60;">Pagamento Confermato con Successo</h2><p>Gentile ${name}, grazie per il tuo pagamento. La transazione è stata verificata con successo.</p><div class="box"><div><strong>Riferimento:</strong> ${ref}</div>${inv ? `<div><strong>Fattura:</strong> ${inv}</div>` : ''}<div><strong>Importo Pagato:</strong> ${amount}</div>${usdEq}<div><strong>ID Transazione:</strong> ${txn}</div><div><strong>Data:</strong> ${verifiedAt}</div><div><strong>Tour:</strong> ${tour}</div></div>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nRef: ${ref}\nPaid: ${amount}\nTransaction: ${txn}\nVerified: ${verifiedAt}`;

    return { subject, html, text };
  }

  private renderPaymentFailedOrExpired(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const amount = sanitizePlainText(vars.formattedAmount);
    const retryUrl = vars.retryUrl;
    const reason = vars.safeReason
      ? sanitizePlainText(vars.safeReason)
      : 'Payment could not be completed';

    const subjects: Record<SupportedLocale, string> = {
      en: `Payment Notice: Action Required for Booking #${ref}`,
      ar: `تنبيه سداد: مطلوب إجراء بخصوص الحجز #${ref}`,
      es: `Aviso de Pago: Acción requerida para Reserva #${ref}`,
      pt: `Aviso de Pagamento: Ação necessária para Reserva #${ref}`,
      it: `Avviso di Pagamento: Azione richiesta per Prenotazione #${ref}`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #e67e22;">Payment Incomplete</h2><p>Dear ${name}, the payment attempt for booking <strong>#${ref}</strong> was not completed.</p><div class="box"><div><strong>Reason:</strong> ${reason}</div><div><strong>Amount:</strong> ${amount}</div></div><p style="text-align:center;"><a href="${retryUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Retry Secure Payment</a></p>`,
      ar: `<h2 style="color: #e67e22;">تعذر إتمام عملية السداد</h2><p>عزيزنا ${name}، لم تكتمل محاولة السداد للحجز رقم <strong>#${ref}</strong>.</p><div class="box"><div><strong>السبب:</strong> ${reason}</div><div><strong>المبلغ المستحق:</strong> ${amount}</div></div><p style="text-align:center;"><a href="${retryUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">إعادة محاولة السداد الآمن</a></p>`,
      es: `<h2 style="color: #e67e22;">Pago Incompleto</h2><p>Estimado/a ${name}, el intento de pago para la reserva <strong>#${ref}</strong> no pudo completarse.</p><div class="box"><div><strong>Motivo:</strong> ${reason}</div><div><strong>Importe:</strong> ${amount}</div></div><p style="text-align:center;"><a href="${retryUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Reintentar Pago</a></p>`,
      pt: `<h2 style="color: #e67e22;">Pagamento Não Concluído</h2><p>Prezado/a ${name}, o pagamento da reserva <strong>#${ref}</strong> não pôde ser concluído.</p><div class="box"><div><strong>Motivo:</strong> ${reason}</div><div><strong>Valor:</strong> ${amount}</div></div><p style="text-align:center;"><a href="${retryUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Tentar Novamente</a></p>`,
      it: `<h2 style="color: #e67e22;">Pagamento non Completato</h2><p>Gentile ${name}, il tentativo di pagamento per la prenotazione <strong>#${ref}</strong> non è andato a buon fine.</p><div class="box"><div><strong>Motivo:</strong> ${reason}</div><div><strong>Importo:</strong> ${amount}</div></div><p style="text-align:center;"><a href="${retryUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Riprova il Pagamento</a></p>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nBooking: #${ref}\nAmount: ${amount}\nRetry: ${retryUrl}`;

    return { subject, html, text };
  }

  private renderRefundCompleted(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const refundAmt = sanitizePlainText(vars.formattedRefundAmount);
    const refundRef = sanitizePlainText(vars.refundReference);
    const balance = vars.formattedRemainingBalance
      ? sanitizePlainText(vars.formattedRemainingBalance)
      : null;

    const subjects: Record<SupportedLocale, string> = {
      en: `Refund Processed: ${refundAmt} for Booking #${ref}`,
      ar: `تم معالجة الاسترداد: ${refundAmt} للحجز #${ref}`,
      es: `Reembolso Procesado: ${refundAmt} para Reserva #${ref}`,
      pt: `Reembolso Processado: ${refundAmt} para Reserva #${ref}`,
      it: `Rimborso Elaborato: ${refundAmt} per Prenotazione #${ref}`,
    };

    const content: Record<SupportedLocale, string> = {
      en: `<h2 style="color: #f7e7a0;">Refund Confirmation</h2><p>Dear ${name}, a refund of <strong>${refundAmt}</strong> has been processed for booking #${ref}.</p><div class="box"><div><strong>Refund Reference:</strong> ${refundRef}</div><div><strong>Refund Amount:</strong> ${refundAmt}</div>${balance ? `<div><strong>Remaining Booking Balance:</strong> ${balance}</div>` : ''}</div><p style="font-size:12px;color:#8e8777;">Funds will appear in your account within 5-10 business days depending on your bank.</p>`,
      ar: `<h2 style="color: #f7e7a0;">تأكيد استرداد المبلغ</h2><p>عزيزنا ${name}، تم إتمام معالجة استرداد مبلغ <strong>${refundAmt}</strong> بنجاح لحجزك رقم #${ref}.</p><div class="box"><div><strong>مرجع الاسترداد:</strong> ${refundRef}</div><div><strong>المبلغ المسترد:</strong> ${refundAmt}</div>${balance ? `<div><strong>الرصيد المتبقي للحجز:</strong> ${balance}</div>` : ''}</div><p style="font-size:12px;color:#8e8777;">سيظهر المبلغ في حسابك البنكي خلال 5 إلى 10 أيام عمل وفقاً لسياسة البنك المصدر.</p>`,
      es: `<h2 style="color: #f7e7a0;">Confirmación de Reembolso</h2><p>Estimado/a ${name}, se ha procesado un reembolso de <strong>${refundAmt}</strong> para la reserva #${ref}.</p><div class="box"><div><strong>Referencia de Reembolso:</strong> ${refundRef}</div><div><strong>Importe Reembolsado:</strong> ${refundAmt}</div>${balance ? `<div><strong>Saldo Restante:</strong> ${balance}</div>` : ''}</div>`,
      pt: `<h2 style="color: #f7e7a0;">Confirmação de Reembolso</h2><p>Prezado/a ${name}, processamos o reembolso de <strong>${refundAmt}</strong> para a reserva #${ref}.</p><div class="box"><div><strong>Referência:</strong> ${refundRef}</div><div><strong>Valor Reembolsado:</strong> ${refundAmt}</div>${balance ? `<div><strong>Saldo Restante:</strong> ${balance}</div>` : ''}</div>`,
      it: `<h2 style="color: #f7e7a0;">Conferma di Rimborso</h2><p>Gentile ${name}, abbiamo elaborato un rimborso di <strong>${refundAmt}</strong> per la prenotazione #${ref}.</p><div class="box"><div><strong>Riferimento Rimborso:</strong> ${refundRef}</div><div><strong>Importo Rimborsato:</strong> ${refundAmt}</div>${balance ? `<div><strong>Saldo Residuo:</strong> ${balance}</div>` : ''}</div>`,
    };

    const subject = subjects[locale];
    const html = this.getBaseLayout(locale, content[locale]);
    const text = `DUNAS TRAVEL\n\n${subject}\n\nDear ${name},\nRefund: ${refundAmt}\nRef: ${refundRef}\nBooking: #${ref}`;

    return { subject, html, text };
  }

  private renderBookingStatusChanged(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const tour = sanitizePlainText(vars.tourTitle);
    const status = sanitizePlainText(vars.status);
    const reason = vars.reason ? sanitizePlainText(vars.reason) : '';

    const subject = `Booking Update: #${ref} is now ${status}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Booking Status Updated</h2><p>Dear ${name}, the status of your booking for <strong>${tour}</strong> (Ref: #${ref}) has changed to <strong>${status}</strong>.</p>${reason ? `<div class="box"><strong>Note:</strong> ${reason}</div>` : ''}`,
    );
    const text = `DUNAS TRAVEL\n\nBooking #${ref} status changed to ${status}.\nTour: ${tour}\n${reason ? `Note: ${reason}` : ''}`;
    return { subject, html, text };
  }

  private renderInvoiceEvent(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const inv = sanitizePlainText(vars.invoiceNumber);
    const ref = sanitizePlainText(vars.referenceCode);
    const total = sanitizePlainText(vars.formattedTotal);
    const status = sanitizePlainText(vars.invoiceStatus);

    const subject = `Invoice ${inv} (${status}) for Booking #${ref}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Invoice Notification</h2><p>Dear ${name}, invoice <strong>${inv}</strong> for booking #${ref} is currently marked as <strong>${status}</strong>.</p><div class="box"><div><strong>Invoice:</strong> ${inv}</div><div><strong>Total:</strong> ${total}</div><div><strong>Status:</strong> ${status}</div></div>`,
    );
    const text = `DUNAS TRAVEL\n\nInvoice ${inv} for booking #${ref}: ${total} (Status: ${status})`;
    return { subject, html, text };
  }

  private renderInquiryEvent(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const dest = vars.destinations
      ? sanitizePlainText(vars.destinations)
      : 'Egypt & Middle East';

    const subject = `Bespoke Travel Inquiry Received: Ref #${ref}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Custom Itinerary Inquiry</h2><p>Dear ${name}, thank you for your tailor-made journey request. A dedicated travel designer has been assigned to create your bespoke itinerary for ${dest}.</p><div class="box"><div><strong>Inquiry Reference:</strong> ${ref}</div><div><strong>Destinations:</strong> ${dest}</div></div>`,
    );
    const text = `DUNAS TRAVEL\n\nInquiry #${ref} received for ${dest}. A luxury travel designer will contact you shortly.`;
    return { subject, html, text };
  }

  private renderContactSubmitted(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const subj = sanitizePlainText(vars.subject);

    const subject = `Inquiry Acknowledgment: ${subj} (Ref: ${ref})`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Message Received</h2><p>Dear ${name}, thank you for contacting Dunas Travel. Our team will review your inquiry regarding "${subj}" and reply within 24 hours.</p><div class="box"><div><strong>Reference Code:</strong> ${ref}</div></div>`,
    );
    const text = `DUNAS TRAVEL\n\nThank you ${name}. Your message (${subj}) has been received with reference #${ref}.`;
    return { subject, html, text };
  }

  private renderReviewEvent(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const reviewer = sanitizePlainText(vars.reviewerName);
    const tour = sanitizePlainText(vars.tourTitle);

    const subject = `Review Received for ${tour}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Thank you for your review</h2><p>Dear ${reviewer}, thank you for sharing your experience on <strong>${tour}</strong>. Your feedback helps us maintain the highest standard of luxury hospitality.</p>`,
    );
    const text = `DUNAS TRAVEL\n\nDear ${reviewer}, thank you for reviewing ${tour}.`;
    return { subject, html, text };
  }

  private renderAdminAssignment(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const assignee = sanitizePlainText(vars.assigneeName);
    const entity = sanitizePlainText(vars.entityType);
    const ref = sanitizePlainText(vars.referenceCode);
    const dashUrl = vars.dashboardUrl;

    const subject = `[Admin Assignment] ${entity} #${ref} assigned to ${assignee}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Assignment Alert</h2><p>Hello ${assignee}, you have been assigned to handle <strong>${entity} #${ref}</strong>.</p><p><a href="${dashUrl}" style="display:inline-block;padding:10px 20px;background:#c9a227;color:#07060a;border-radius:6px;font-weight:bold;">View in Dashboard</a></p>`,
    );
    const text = `DUNAS TRAVEL ADMIN\n\nAssignment: ${entity} #${ref} assigned to ${assignee}.\nDashboard: ${dashUrl}`;
    return { subject, html, text };
  }

  private renderCommissionUpdated(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const partner = sanitizePlainText(vars.partnerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const comm = sanitizePlainText(vars.formattedCommission);
    const status = sanitizePlainText(vars.status);

    const subject = `Partner Commission Update: #${ref} (${status})`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Commission Notification</h2><p>Dear ${partner}, commission #${ref} has been updated to <strong>${status}</strong>.</p><div class="box"><div><strong>Commission Amount:</strong> ${comm}</div><div><strong>Status:</strong> ${status}</div></div>`,
    );
    const text = `DUNAS TRAVEL PARTNERS\n\nCommission #${ref}: ${comm} (Status: ${status})`;
    return { subject, html, text };
  }

  private renderWalletTransaction(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const account = sanitizePlainText(vars.accountName);
    const type = sanitizePlainText(vars.transactionType);
    const amt = sanitizePlainText(vars.formattedAmount);
    const bal = sanitizePlainText(vars.formattedBalance);

    const subject = `B2B Wallet Alert: ${type} ${amt}`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Wallet Transaction</h2><p>Dear ${account}, a wallet transaction was recorded on your account.</p><div class="box"><div><strong>Type:</strong> ${type}</div><div><strong>Amount:</strong> ${amt}</div><div><strong>Updated Balance:</strong> ${bal}</div></div>`,
    );
    const text = `DUNAS TRAVEL B2B\n\nWallet ${type}: ${amt}. Balance: ${bal}`;
    return { subject, html, text };
  }

  private renderCustomerDocumentUpdate(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const ref = sanitizePlainText(vars.referenceCode);
    const docTitle = sanitizePlainText(vars.documentTitle);
    const docUrl = vars.documentUrl;

    const subject = `Travel Documents Ready: ${docTitle} (Booking #${ref})`;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Travel Documents Available</h2><p>Dear ${name}, your travel document <strong>${docTitle}</strong> for booking #${ref} is now ready to download.</p><p style="text-align:center;"><a href="${docUrl}" style="display:inline-block;padding:12px 24px;background:#c9a227;color:#07060a;border-radius:8px;font-weight:bold;">Download Document</a></p>`,
    );
    const text = `DUNAS TRAVEL\n\nDear ${name}, your document ${docTitle} for booking #${ref} is ready: ${docUrl}`;
    return { subject, html, text };
  }

  private renderSystemIncident(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const name = sanitizePlainText(vars.customerName);
    const summary = sanitizePlainText(vars.incidentSummary);
    const action = sanitizePlainText(vars.actionTaken);

    const subject = 'Operational Notification regarding your transaction';
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">Service Advisory</h2><p>Dear ${name},</p><p>${summary}</p><div class="box"><strong>Action Taken:</strong> ${action}</div><p>We apologize for any inconvenience. Your concierge is on standby for any questions.</p>`,
    );
    const text = `DUNAS TRAVEL\n\nService Advisory:\n${summary}\nAction: ${action}`;
    return { subject, html, text };
  }

  private renderMarketingCampaign(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const title = sanitizePlainText(vars.title);
    const content = sanitizePlainText(vars.content);
    const name = vars.customerName
      ? sanitizePlainText(vars.customerName)
      : 'Valued Traveler';
    const unsub = vars.unsubscribeUrl;

    const subject = title;
    const bodyHtml = `<h2 style="color: #f7e7a0;">${title}</h2><p>Dear ${name},</p><p>${content}</p><div style="margin-top:25px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;color:#8e8777;text-align:center;"><p>You received this because you opted in to Dunas Travel luxury communications. <a href="${unsub}">Unsubscribe instantly</a></p></div>`;
    const html = this.getBaseLayout(locale, bodyHtml);
    const text = `DUNAS TRAVEL\n\n${title}\n\nDear ${name},\n${content}\n\nUnsubscribe: ${unsub}`;
    return { subject, html, text };
  }

  private renderGenericNotice(
    locale: SupportedLocale,
    vars: Record<string, any>,
  ): { subject: string; html: string; text: string } {
    const title = sanitizePlainText(vars.title || 'Notification');
    const msg = sanitizePlainText(
      vars.message || 'Notification from Dunas Travel',
    );
    const subject = title;
    const html = this.getBaseLayout(
      locale,
      `<h2 style="color: #f7e7a0;">${title}</h2><p>${msg}</p>`,
    );
    const text = `DUNAS TRAVEL\n\n${title}\n\n${msg}`;
    return { subject, html, text };
  }
}
