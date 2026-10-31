import { NotificationType as PrismaNotificationType } from '@prisma/client';

export type SupportedLocale = 'en' | 'ar' | 'es' | 'pt' | 'it';

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en',
  'ar',
  'es',
  'pt',
  'it',
];

export enum EmailEventType {
  // 1-5 Auth
  USER_REGISTRATION = 'auth.registered',
  EMAIL_VERIFICATION = 'auth.verification',
  VERIFICATION_RESEND = 'auth.verification_resend',
  PASSWORD_RESET_REQUEST = 'auth.password_reset_request',
  PASSWORD_RESET_COMPLETION = 'auth.password_reset_completion',

  // 6-10 Bookings
  BOOKING_CREATED = 'booking.created',
  BOOKING_PAYMENT_REQUIRED = 'booking.payment_required',
  FREE_BOOKING_CREATED = 'booking.free_created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_PARTIALLY_PAID = 'booking.partially_paid',

  // 11-16 Payments & Refunds
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_EXPIRED = 'payment.expired',
  PAYMENT_RETRY = 'payment.retry',
  REFUND_COMPLETED = 'payment.refund_completed',
  PARTIAL_REFUND_COMPLETED = 'payment.partial_refund_completed',

  // 17-19 Booking lifecycle
  BOOKING_CANCELLED_BEFORE_PAYMENT = 'booking.cancelled_unpaid',
  BOOKING_CANCELLED_AFTER_PAYMENT = 'booking.cancelled_paid',
  BOOKING_STATUS_CHANGED = 'booking.status_changed',

  // 20-22 Invoices
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_VOIDED = 'invoice.voided',

  // 23-26 Inquiries
  INQUIRY_CREATED = 'inquiry.created',
  INQUIRY_ASSIGNED = 'inquiry.assigned',
  INQUIRY_STATUS_CHANGED = 'inquiry.status_changed',
  INQUIRY_CONVERTED = 'inquiry.converted',

  // 27 Contact
  CONTACT_SUBMITTED = 'contact.submitted',

  // 28-29 Reviews
  REVIEW_SUBMITTED = 'review.submitted',
  REVIEW_MODERATED = 'review.moderated',

  // 30 Staff Assignment
  ADMIN_ASSIGNMENT = 'admin.assignment',

  // 31-32 Financial & Operations
  COMMISSION_UPDATED = 'commission.updated',
  WALLET_TRANSACTION = 'wallet.transaction',

  // 33-35 Customer, Incident & Marketing
  CUSTOMER_DOCUMENT_UPDATE = 'customer.document_update',
  SYSTEM_INCIDENT = 'system.incident',
  MARKETING_CAMPAIGN = 'campaign.marketing',
}

export const ALL_EMAIL_EVENT_TYPES: EmailEventType[] =
  Object.values(EmailEventType);

export type OriginEntityType =
  | 'BOOKING'
  | 'PAYMENT'
  | 'USER'
  | 'INQUIRY'
  | 'CONTACT'
  | 'INVOICE'
  | 'REVIEW'
  | 'COMMISSION'
  | 'WALLET'
  | 'CAMPAIGN'
  | 'SYSTEM';

/**
 * Maps granular EmailEventType and recipient kind to Prisma NotificationType enum
 */
export function mapEventToPrismaNotificationType(
  eventType: EmailEventType,
  isInternalRecipient: boolean = false,
): PrismaNotificationType {
  if (isInternalRecipient) {
    return PrismaNotificationType.INTERNAL_SALES_ALERT;
  }

  switch (eventType) {
    case EmailEventType.EMAIL_VERIFICATION:
    case EmailEventType.VERIFICATION_RESEND:
      return PrismaNotificationType.USER_VERIFICATION;
    case EmailEventType.PASSWORD_RESET_REQUEST:
    case EmailEventType.PASSWORD_RESET_COMPLETION:
      return PrismaNotificationType.PASSWORD_RESET;
    default:
      return PrismaNotificationType.CUSTOMER_ACKNOWLEDGMENT;
  }
}

export interface MonetaryDetails {
  amount: number | string;
  currency: string;
  originalAmount?: number | string | null;
  originalCurrency?: string | null;
  exchangeRate?: number | string | null;
  amountUsd?: number | string | null;
}
