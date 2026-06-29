import {
  NotificationType,
  NotificationDeliveryStatus,
} from './notification.enums';

export interface NotificationDeliveryLogRecord {
  id: string;
  notificationType: NotificationType;
  originReferenceCode: string;
  originEntityType: string;
  recipientEmail: string;
  status: NotificationDeliveryStatus;
  attempts: number;
  lastAttemptAt: Date | null;
  failureReason: string | null;
  providerResponseId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
