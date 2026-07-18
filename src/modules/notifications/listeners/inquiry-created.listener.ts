import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { INQUIRY_EVENTS, InquiryCreatedPayload } from '../../inquiries/events';
import { EmailCompositionService } from '../services/email-composition.service';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { NotificationType } from '../types';

@Injectable()
export class InquiryCreatedListener {
  private readonly logger = new Logger(InquiryCreatedListener.name);

  constructor(
    private readonly compositionService: EmailCompositionService,
    private readonly deliveryService: EmailDeliveryService,
  ) {}

  @OnEvent(INQUIRY_EVENTS.CREATED, { async: true })
  async handleInquiryCreatedEvent(payload: InquiryCreatedPayload) {
    this.logger.log(
      `Received inquiry.created event for ref: ${payload?.referenceCode}`,
    );

    try {
      // 1. Compose emails
      const customerAck =
        await this.compositionService.composeInquiryCustomerAcknowledgment(
          payload,
        );
      const internalAlert =
        await this.compositionService.composeInquiryInternalAlert(payload);

      // 2. Deliver emails (these handle their own retries and logging)
      await Promise.all([
        this.deliveryService.deliver(
          NotificationType.CUSTOMER_ACKNOWLEDGMENT,
          payload.referenceCode,
          'TAILOR_MADE_INQUIRY',
          customerAck,
        ),
        this.deliveryService.deliver(
          NotificationType.INTERNAL_SALES_ALERT,
          payload.referenceCode,
          'TAILOR_MADE_INQUIRY',
          internalAlert,
        ),
      ]);
    } catch (error: any) {
      this.logger.error(
        `Failed to process inquiry.created event: ${error.message}`,
        error.stack,
      );
      // Deliberately do not rethrow. Listener failures must not propagate back to emitter.
    }
  }
}
