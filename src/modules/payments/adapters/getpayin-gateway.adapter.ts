import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  CheckoutSessionData,
  CreateCheckoutSessionData,
  IPaymentGatewayPort,
  PaymentGatewayReadiness,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

/**
 * Fail-closed GetPayIn boundary.
 *
 * GetPayIn's public site advertises payment links, but its merchant API and
 * webhook signing contract are supplied during merchant onboarding rather
 * than published publicly. Network calls must not be implemented from guessed
 * field names or signatures. This adapter makes the provider selectable and
 * exposes the exact missing onboarding inputs while refusing money movement.
 */
@Injectable()
export class GetPayInGatewayAdapter implements IPaymentGatewayPort {
  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'GETPAYIN';
  }

  getReadiness(): PaymentGatewayReadiness {
    const required = [
      'GETPAYIN_API_BASE_URL',
      'GETPAYIN_API_KEY',
      'GETPAYIN_WEBHOOK_SECRET',
      'GETPAYIN_MERCHANT_ID',
      'GETPAYIN_CONTRACT_VERSION',
    ];
    const missingConfiguration = required.filter(
      (key) => !this.configService.get<string>(key)?.trim(),
    );
    // The contract implementation remains deliberately disabled until the
    // official merchant specification is checked into docs/vendor/getpayin.
    if (missingConfiguration.length === 0) {
      missingConfiguration.push('GETPAYIN_OFFICIAL_API_CONTRACT');
    }
    return {
      provider: this.getProviderName(),
      enabled: false,
      configured: false,
      mode:
        this.configService.get<string>('GETPAYIN_MODE') === 'production'
          ? 'production'
          : 'sandbox',
      supportedCurrencies: ['USD', 'EUR', 'EGP'],
      missingConfiguration,
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

  async refund(
    _transactionId: string,
    _amount?: number,
    _idempotencyKey?: string,
  ): Promise<{ refundId: string }> {
    return this.unavailable();
  }

  async expireSession(_sessionId: string): Promise<void> {
    return this.unavailable();
  }

  private unavailable(): never {
    throw new ServiceUnavailableException(
      'GetPayIn is not active until the official merchant API and webhook contract is installed',
    );
  }
}
