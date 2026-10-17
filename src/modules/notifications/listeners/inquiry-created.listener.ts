import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { INQUIRY_EVENTS, InquiryCreatedPayload } from '../../inquiries/events';
import { EmailCompositionService } from '../services/email-composition.service';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { NotificationType } from '../types';

import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import {
  InAppNotificationCategory,
  InAppNotificationPriority,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class InquiryCreatedListener {
  private readonly logger = new Logger(InquiryCreatedListener.name);

  constructor(
    private readonly compositionService: EmailCompositionService,
    private readonly deliveryService: EmailDeliveryService,
    private readonly inAppNotifications: InAppNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(INQUIRY_EVENTS.CREATED, { async: true })
  async handleInquiryCreatedEvent(payload: InquiryCreatedPayload) {
    this.logger.log(
      `Received inquiry.created event for ref: ${payload?.referenceCode}`,
    );

    try {
      // In-App Notification for Admins
      await this.inAppNotifications.notifyAdmins({
        category: InAppNotificationCategory.INQUIRY,
        priority: InAppNotificationPriority.HIGH,
        title: `New Custom Trip Inquiry #${payload.referenceCode}`,
        message: `Tailor-made travel inquiry from ${payload.fullName} (${payload.email})`,
        entityType: 'INQUIRY',
        entityId: payload.referenceCode,
        deepLink: '/admin/inquiries',
        metadata: { referenceCode: payload.referenceCode },
      });

      // In-App Notification for Customer if account exists
      if (payload.email) {
        try {
          const matchedUser = await this.prisma.user.findFirst({
            where: {
              email: { equals: payload.email, mode: 'insensitive' },
              deletedAt: null,
            },
            select: { id: true },
          });

          if (matchedUser) {
            const destLabel = Array.isArray(payload.destinations)
              ? payload.destinations.join(', ')
              : 'Custom Trip';
            await this.inAppNotifications.createNotification({
              userId: matchedUser.id,
              category: InAppNotificationCategory.INQUIRY,
              priority: InAppNotificationPriority.NORMAL,
              title: `Custom Trip Request #${payload.referenceCode} Received`,
              message: `Your tailored travel request for ${destLabel} has been submitted successfully to our concierge team.`,
              targetApp: 'CUSTOMER',
              entityType: 'INQUIRY',
              entityId: payload.referenceCode,
              deepLink: '/account/profile',
              metadata: { referenceCode: payload.referenceCode },
            });
          }
        } catch (custNotifErr: any) {
          this.logger.warn(
            `Could not create customer in-app notification: ${custNotifErr.message}`,
          );
        }
      }
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
