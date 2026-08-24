import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import {
  CheckoutSessionData,
  CreateCheckoutSessionData,
  IPaymentGatewayPort,
  PaymentGatewayReadiness,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

@Injectable()
export class DisabledPaymentGatewayAdapter implements IPaymentGatewayPort {
  getProviderName(): string {
    return 'DISABLED';
  }

  getReadiness(): PaymentGatewayReadiness {
    return {
      provider: this.getProviderName(),
      enabled: false,
      configured: false,
      mode: 'disabled',
      supportedCurrencies: [],
      missingConfiguration: ['PAYMENT_PROVIDER'],
    };
  }

  async createSession(
    _input: CreateCheckoutSessionData,
  ): Promise<CheckoutSessionData> {
    return this.unavailable();
  }

  async verifyAndParseWebhook(
    _req: Request,
    _rawBody: Buffer,
  ): Promise<WebhookPayload> {
    return this.unavailable();
  }

  async refund(): Promise<{ refundId: string }> {
    return this.unavailable();
  }

  async expireSession(): Promise<void> {
    return this.unavailable();
  }

  private unavailable(): never {
    throw new ServiceUnavailableException('Online payments are not enabled');
  }
}
