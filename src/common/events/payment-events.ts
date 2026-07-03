export const PAYMENT_EVENTS = {
  INITIATED: 'payment.initiated',
  SUCCEEDED: 'payment.succeeded',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
} as const;

export interface PaymentInitiatedPayload {
  paymentId: string;
  bookingId: string;
  amountUsd: number;
  gateway: string;
}

export interface PaymentSucceededPayload {
  paymentId: string;
  bookingId: string;
  amountUsd: number;
  transactionId: string;
  gateway: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  bookingId: string;
  reason: string;
  gateway: string;
}

export interface PaymentRefundedPayload {
  paymentId: string;
  bookingId: string;
  amountUsd: number;
  reason?: string;
  gateway: string;
}
