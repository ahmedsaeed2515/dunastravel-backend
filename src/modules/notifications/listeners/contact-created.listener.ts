import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CONTACT_CREATED_EVENT,
  ContactCreatedEvent,
} from '../../contact-submissions/events/contact-created.event';
import { EmailCompositionService } from '../services/email-composition.service';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { NotificationType } from '../types';

@Injectable()
export class ContactCreatedListener {
  private readonly logger = new Logger(ContactCreatedListener.name);

  constructor(
    private readonly compositionService: EmailCompositionService,
    private readonly deliveryService: EmailDeliveryService,
  ) {}

  @OnEvent(CONTACT_CREATED_EVENT, { async: true })
  async handleContactCreatedEvent(event: ContactCreatedEvent) {
    this.logger.log(
      `Received ${CONTACT_CREATED_EVENT} for Ref: ${event.referenceCode}`,
    );

    try {
      // 1. Compose emails
      const customerAck =
        this.compositionService.composeContactCustomerAcknowledgment(event);
      const internalAlert =
        this.compositionService.composeContactInternalAlert(event);

      // 2. Deliver emails (these handle their own retries and logging)
      await Promise.all([
        this.deliveryService.deliver(
          NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          event.referenceCode,
          'CONTACT_SUBMISSION',
          customerAck,
        ),
        this.deliveryService.deliver(
          NotificationType.INTERNAL_SALES_ALERT,
          event.referenceCode,
          'CONTACT_SUBMISSION',
          internalAlert,
        ),
      ]);

      this.logger.log(
        `Completed handling ${CONTACT_CREATED_EVENT} for Ref: ${event.referenceCode}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to process contact.created event: ${error.message}`,
        error.stack,
      );
    }
  }
}
