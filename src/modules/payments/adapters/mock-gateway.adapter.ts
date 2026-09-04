import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  CheckoutSessionData,
  CreateCheckoutSessionData,
  GatewayPaymentStatus,
  GatewayRefundResult,
  IPaymentGatewayPort,
  PaymentGatewayReadiness,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

@Injectable()
export class MockPaymentGatewayAdapter implements IPaymentGatewayPort {
  getProviderName(): string {
    return 'MOCK';
  }

  getReadiness(): PaymentGatewayReadiness {
    return {
      provider: this.getProviderName(),
      state: 'CONFIGURED',
      enabled: true,
      configured: true,
      mode: 'sandbox',
      supportedCurrencies: ['USD', 'EUR', 'EGP'],
      missingConfiguration: [],
    };
  }

  async createSession(
    input: CreateCheckoutSessionData,
  ): Promise<CheckoutSessionData> {
    const providerInvoiceId = `MOCK-INV-${Date.now()}`;
    const url = `/booking-success?payment_id=${encodeURIComponent(input.paymentId)}&mock_success=true`;
    return {
      url,
      providerInvoiceId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async verifyAndParseWebhook(
    _req: Request,
    _rawBody: Buffer,
  ): Promise<WebhookPayload> {
    const mockId = `MOCK-${Date.now()}`;
    return {
      eventId: `mock-evt-${Date.now()}`,
      event: 'invoice.paid',
      providerInvoiceId: mockId,
      providerStatus: 'PAID',
      status: 'COMPLETED',
      rawEvent: { mock: true },
    };
  }

  async refund(
    providerInvoiceId: string,
    _amount: string,
    _idempotencyKey: string,
  ): Promise<GatewayRefundResult> {
    return {
      providerInvoiceId: String(providerInvoiceId),
      providerStatus: 'REFUNDED',
      authCode: 'MOCK-AUTH',
      refundAmount: '0.00',
    };
  }

  async checkStatus(providerInvoiceId: string): Promise<GatewayPaymentStatus> {
    return {
      providerInvoiceId: String(providerInvoiceId),
      providerStatus: 'PAID',
      authCode: 'MOCK-AUTH',
    };
  }

  verifyCallback(payload: any): string {
    return String(payload.invoice_id || 'MOCK-INV');
  }

  async expireSession(): Promise<void> {}
}
