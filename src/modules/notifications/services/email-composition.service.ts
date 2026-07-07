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

  async getTemplateFromDb(templateName: string, variables: Record<string, any>, fallbackRender: (vars: any) => any): Promise<{ subject: string, html: string, text: string }> {
    const cacheKey = `email_template:${templateName}`;
    let template = await this.cacheManager.get<any>(cacheKey);

    if (!template) {
      template = await this.prisma.emailTemplate.findUnique({ where: { name: templateName } });
      if (template) {
        await this.cacheManager.set(cacheKey, template, 3600000); // 1 hour
      }
    }

    if (template) {
      let html = template.bodyHtml;
      let subject = template.subject;
      
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const strVal = String(value);
        html = html.replace(regex, strVal);
        subject = subject.replace(regex, strVal);
      }
      
      return { subject, html, text: html.replace(/<[^>]*>?/gm, '') };
    }

    // Fallback to hardcoded template
    return fallbackRender(variables);
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

    const template = await this.getTemplateFromDb('inquiry_customer_ack', variables, renderInquiryCustomerAcknowledgment);

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'INQUIRY_CUSTOMER_ACK' },
    };
  }

  async composeInquiryInternalAlert(payload: InquiryCreatedPayload): Promise<EmailPayload> {
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

    const template = await this.getTemplateFromDb('inquiry_internal_alert', variables, renderInquiryInternalAlert);

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

    const template = await this.getTemplateFromDb('contact_customer_ack', variables, renderContactCustomerAcknowledgment);

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'CONTACT_CUSTOMER_ACK' },
    };
  }

  async composeContactInternalAlert(payload: ContactCreatedEvent): Promise<EmailPayload> {
    this.validateContactPayload(payload);
    
    const variables = {
      customerName: `${payload.firstName} ${payload.lastName}`,
      customerEmail: payload.email,
      subject: payload.subject,
      message: payload.message,
      submittedAt: payload.submittedAt.toLocaleDateString(),
      adminDashboardUrl: this.adminDashboardUrl,
    };

    const template = await this.getTemplateFromDb('contact_internal_alert', variables, renderContactInternalAlert);

    return {
      to: this.internalSalesEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'CONTACT_INTERNAL_ALERT' },
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
}
