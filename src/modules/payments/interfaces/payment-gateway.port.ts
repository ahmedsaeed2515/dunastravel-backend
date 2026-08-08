import { Request } from 'express';

export interface CheckoutSessionData {
  url: string;
  transactionId: string;
}

export interface WebhookPayload {
  eventId: string;
  paymentId: string;
  bookingId: string;
  amountUsd: number;
  currency?: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  rawEvent: Record<string, unknown>;
}

export const IPaymentGatewayPort = Symbol('IPaymentGatewayPort');

export interface IPaymentGatewayPort {
  /**
   * Initializes a checkout session with the payment provider.
   * @param bookingId The ID of the booking to pay for.
   * @param amountUsd The amount to charge in USD.
   * @param currency The currency to charge in.
   * @param referenceCode A human-readable reference code.
   * @param idempotencyKey Optional idempotency key for session creation.
   */
  createSession(
    bookingId: string,
    amountUsd: number,
    currency: string,
    referenceCode: string,
    idempotencyKey?: string,
  ): Promise<CheckoutSessionData>;

  /**
   * Verifies the signature of the incoming webhook and parses the payload into a standard format.
   * @param req The incoming HTTP request.
   * @param rawBody The raw buffer of the request body.
   */
  verifyAndParseWebhook(req: Request, rawBody: Buffer): Promise<WebhookPayload>;

  /**
   * Identifies the name of the provider (e.g. 'GENERIC_GATEWAY').
   */
  getProviderName(): string;

  /**
   * Refunds a captured payment.
   * @param transactionId The ID of the transaction to refund.
   * @param amount Optional amount to refund for partial refunds. If not provided, full amount is refunded.
   * @param idempotencyKey Optional idempotency key for refund request.
   */
  refund(
    transactionId: string,
    amount?: number,
    idempotencyKey?: string,
  ): Promise<{ refundId: string }>;

  /**
   * Expires a checkout session before its natural TTL.
   * @param sessionId The ID of the session to expire.
   */
  expireSession(sessionId: string): Promise<void>;
}
