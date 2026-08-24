import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  IPaymentGatewayPort,
  CheckoutSessionData,
  CreateCheckoutSessionData,
  PaymentGatewayReadiness,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

@Injectable()
export class GenericPaymentGatewayAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(GenericPaymentGatewayAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * This adapter exists only as a deterministic local/test double. It does not
   * contact a PSP and cannot verify a webhook signature, so allowing it in a
   * deployed environment would let arbitrary JSON mark a booking as paid.
   */
  private assertNonProduction(): void {
    if (
      this.configService.get<string>('nodeEnv') === 'production' ||
      process.env.NODE_ENV === 'production'
    ) {
      throw new ServiceUnavailableException(
        'Online payments are unavailable until a verified payment provider is configured',
      );
    }
  }

  getProviderName(): string {
    return 'GENERIC_GATEWAY';
  }

  getReadiness(): PaymentGatewayReadiness {
    const production =
      this.configService.get<string>('nodeEnv') === 'production' ||
      process.env.NODE_ENV === 'production';
    return {
      provider: this.getProviderName(),
      enabled: !production,
      configured: !production,
      mode: production ? 'disabled' : 'local',
      supportedCurrencies: ['USD'],
      missingConfiguration: production ? ['PAYMENT_PROVIDER'] : [],
    };
  }

  async createSession(
    input: CreateCheckoutSessionData,
  ): Promise<CheckoutSessionData> {
    this.assertNonProduction();
    this.logger.log(
      `[GenericGateway] Creating checkout session for booking ${input.bookingId} (${input.referenceCode}) amount: ${input.amount} ${input.currency}`,
    );
    const mockTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      url: input.successUrl,
      transactionId: mockTransactionId,
    };
  }

  async verifyAndParseWebhook(
    req: Request,
    _rawBody: Buffer,
  ): Promise<WebhookPayload> {
    this.assertNonProduction();
    const body = (req.body || {}) as Record<string, unknown>;
    const eventId = String(body.eventId || body.id || `evt_${Date.now()}`);
    const paymentId = String(body.paymentId || body.transactionId || '');
    const bookingId = String(body.bookingId || body.referenceId || '');
    const amountUsd = Number(body.amountUsd || body.amount || 0);

    let status: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED';
    if (String(body.status).toUpperCase() === 'FAILED') {
      status = 'FAILED';
    } else if (String(body.status).toUpperCase() === 'PENDING') {
      status = 'PENDING';
    }

    return {
      eventId,
      paymentId,
      bookingId,
      amountUsd,
      currency: String(body.currency || 'USD'),
      status,
      rawEvent: body,
    };
  }

  async refund(
    transactionId: string,
    amount?: number,
    _idempotencyKey?: string,
  ): Promise<{ refundId: string }> {
    this.assertNonProduction();
    this.logger.log(
      `[GenericGateway] Refund requested for txn ${transactionId}, amount: ${amount ?? 'full'}`,
    );
    return { refundId: `re_${Date.now()}_${transactionId}` };
  }

  async expireSession(sessionId: string): Promise<void> {
    this.assertNonProduction();
    this.logger.log(`[GenericGateway] Session expired: ${sessionId}`);
  }
}
