import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  IPaymentGatewayPort,
  CheckoutSessionData,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

@Injectable()
export class GenericPaymentGatewayAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(GenericPaymentGatewayAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'GENERIC_GATEWAY';
  }

  async createSession(
    bookingId: string,
    amountUsd: number,
    currency: string,
    referenceCode: string,
    idempotencyKey?: string,
  ): Promise<CheckoutSessionData> {
    this.logger.log(
      `[GenericGateway] Creating checkout session for booking ${bookingId} (${referenceCode}) amount: ${amountUsd} ${currency}`,
    );
    const mockTransactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const redirectUrl = `${this.configService.get<string>('FRONTEND_URL') || 'https://www.dunastravel.com'}/checkout/complete?bookingId=${bookingId}&txn=${mockTransactionId}`;

    return {
      url: redirectUrl,
      transactionId: mockTransactionId,
    };
  }

  async verifyAndParseWebhook(
    req: Request,
    _rawBody: Buffer,
  ): Promise<WebhookPayload> {
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
    this.logger.log(
      `[GenericGateway] Refund requested for txn ${transactionId}, amount: ${amount ?? 'full'}`,
    );
    return { refundId: `re_${Date.now()}_${transactionId}` };
  }

  async expireSession(sessionId: string): Promise<void> {
    this.logger.log(`[GenericGateway] Session expired: ${sessionId}`);
  }
}
