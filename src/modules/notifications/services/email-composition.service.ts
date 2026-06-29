import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly configService: ConfigService) {
    this.internalSalesEmail =
      this.configService.get<string>('mail.internalAlertRecipient') ||
      'sales@dunastravel.com';
    this.adminDashboardUrl =
      this.configService.get<string>('mail.adminDashboardBaseUrl') ||
      'http://localhost:3000/admin';
  }

  composeInquiryCustomerAcknowledgment(
    payload: InquiryCreatedPayload,
  ): EmailPayload {
    this.validateInquiryPayload(payload);
    const template = renderInquiryCustomerAcknowledgment({
      customerName: payload.fullName,
      referenceCode: payload.referenceCode,
      destinations: payload.destinations,
      travelDateRange: `${payload.startDate || 'TBD'} - ${payload.endDate || 'TBD'}`,
      numberOfTravelers: payload.adults + payload.children,
      submittedAt: new Date(payload.createdAt),
    });

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'INQUIRY_CUSTOMER_ACK' },
    };
  }

  composeInquiryInternalAlert(payload: InquiryCreatedPayload): EmailPayload {
    this.validateInquiryPayload(payload);
    const template = renderInquiryInternalAlert({
      customerName: payload.fullName,
      customerEmail: payload.email,
      customerPhone: payload.phone,
      referenceCode: payload.referenceCode,
      destinations: payload.destinations,
      travelDateRange: `${payload.startDate || 'TBD'} - ${payload.endDate || 'TBD'}`,
      numberOfTravelers: payload.adults + payload.children,
      specialRequests: payload.notes || undefined,
      submittedAt: new Date(payload.createdAt),
      adminDashboardUrl: this.adminDashboardUrl,
    });

    return {
      to: this.internalSalesEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'INQUIRY_INTERNAL_ALERT' },
    };
  }

  composeContactCustomerAcknowledgment(
    payload: ContactCreatedEvent,
  ): EmailPayload {
    this.validateContactPayload(payload);
    const template = renderContactCustomerAcknowledgment({
      customerName: `${payload.firstName} ${payload.lastName}`,
      subject: payload.subject,
      submittedAt: payload.submittedAt,
    });

    return {
      to: payload.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: { notificationType: 'CONTACT_CUSTOMER_ACK' },
    };
  }

  composeContactInternalAlert(payload: ContactCreatedEvent): EmailPayload {
    this.validateContactPayload(payload);
    const template = renderContactInternalAlert({
      customerName: `${payload.firstName} ${payload.lastName}`,
      customerEmail: payload.email,
      subject: payload.subject,
      message: payload.message,
      submittedAt: payload.submittedAt,
      adminDashboardUrl: this.adminDashboardUrl,
    });

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
