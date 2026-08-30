import { Request } from 'express';

export interface CheckoutSessionData {
  url: string;
  providerInvoiceId: string;
  expiresAt: Date;
}

export interface CreateCheckoutSessionData {
  paymentId: string;
  bookingId: string;
  referenceCode: string;
  amount: string;
  currency: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    country?: string;
    state?: string;
  };
  idempotencyKey: string;
}

export interface PaymentGatewayReadiness {
  provider: string;
  state:
    | 'DISABLED'
    | 'CONFIG_INCOMPLETE'
    | 'CONFIGURED'
    | 'SANDBOX_VERIFIED'
    | 'LIVE_CONFIGURED'
    | 'LIVE_VERIFIED';
  enabled: boolean;
  configured: boolean;
  mode: 'disabled' | 'sandbox' | 'production' | 'local';
  supportedCurrencies: string[];
  missingConfiguration: string[];
}

export interface WebhookPayload {
  eventId: string;
  event: string;
  providerInvoiceId: string;
  providerStatus:
    | 'PAID'
    | 'UNPAID'
    | 'VOIDED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED'
    | 'REVERSED';
  status:
    | 'COMPLETED'
    | 'FAILED'
    | 'VOIDED'
    | 'REFUNDED'
    | 'PARTIALLY_REFUNDED'
    | 'REVERSED';
  rawEvent: Record<string, unknown>;
}

export interface GatewayPaymentStatus {
  providerInvoiceId: string;
  providerStatus: string;
  authCode: string | null;
}

export interface GatewayRefundResult extends GatewayPaymentStatus {
  refundAmount: string | null;
}

export interface PayLinkCallbackPayload {
  success: string | number | boolean;
  invoice_id: string | number;
  invoice_status: string;
  message: string;
  signature: string;
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
  createSession(input: CreateCheckoutSessionData): Promise<CheckoutSessionData>;

  getReadiness(): PaymentGatewayReadiness;

  /**
   * Verifies the signature of the incoming webhook and parses the payload into a standard format.
   * @param req The incoming HTTP request.
   * @param rawBody The raw buffer of the request body.
   */
  verifyAndParseWebhook(req: Request, rawBody: Buffer): Promise<WebhookPayload>;

  /**
   * Identifies the provider. The only supported online provider is GETPAYIN.
   */
  getProviderName(): string;

  /**
   * Refunds a captured payment.
   * @param transactionId The ID of the transaction to refund.
   * @param amount Optional amount to refund for partial refunds. If not provided, full amount is refunded.
   * @param idempotencyKey Optional idempotency key for refund request.
   */
  refund(
    providerInvoiceId: string,
    amount: string,
    idempotencyKey: string,
  ): Promise<GatewayRefundResult>;

  checkStatus(providerInvoiceId: string): Promise<GatewayPaymentStatus>;

  verifyCallback(payload: PayLinkCallbackPayload): string;

  /**
   * Expires a checkout session before its natural TTL.
   * @param sessionId The ID of the session to expire.
   */
  expireSession(sessionId: string): Promise<void>;
}
