import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaylinkApiError,
  PaylinkClient,
  PaylinkConnectionError,
  PaylinkSignatureError,
} from '@getpayin/paylink';
import { Request } from 'express';
import crypto from 'node:crypto';
import {
  CheckoutSessionData,
  CreateCheckoutSessionData,
  GatewayPaymentStatus,
  GatewayRefundResult,
  IPaymentGatewayPort,
  PayLinkCallbackPayload,
  PaymentGatewayReadiness,
  WebhookPayload,
} from '../interfaces/payment-gateway.port';

const PAYLINK_DEFAULT_BASE_URL = 'https://pay.getpayin.com';
const PAYLINK_EVENTS = new Map<
  string,
  { statuses: WebhookPayload['providerStatus'][]; mapped: WebhookPayload['status'] }
>([
  ['invoice.paid', { statuses: ['PAID'], mapped: 'COMPLETED' }],
  ['invoice.not_paid', { statuses: ['UNPAID'], mapped: 'FAILED' }],
  ['invoice.voided', { statuses: ['VOIDED'], mapped: 'VOIDED' }],
  [
    'invoice.refunded',
    { statuses: ['REFUNDED', 'PARTIALLY_REFUNDED'], mapped: 'REFUNDED' },
  ],
  [
    'invoice.authorization_reversed',
    { statuses: ['REVERSED'], mapped: 'REVERSED' },
  ],
]);

@Injectable()
export class GetPayInGatewayAdapter implements IPaymentGatewayPort {
  private readonly logger = new Logger(GetPayInGatewayAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  getProviderName(): string {
    return 'GETPAYIN';
  }

  getReadiness(): PaymentGatewayReadiness {
    const required = [
      'GETPAYIN_AUTH_TOKEN',
      'GETPAYIN_HASH_TOKEN',
      'GETPAYIN_REDIRECT_URL',
      'GETPAYIN_WEBHOOK_URL',
    ];
    const missingConfiguration = required.filter((key) => {
      if (key === 'GETPAYIN_AUTH_TOKEN') return !this.authToken();
      if (key === 'GETPAYIN_HASH_TOKEN') return !this.hashToken();
      return !this.value(key);
    });
    const enabled =
      this.configService.get<string>('payments.provider')?.toUpperCase() ===
      'GETPAYIN';
    const mode =
      this.configService.get<string>('GETPAYIN_MODE') === 'production'
        ? 'production'
        : 'sandbox';

    return {
      provider: this.getProviderName(),
      state: !enabled
        ? 'DISABLED'
        : missingConfiguration.length > 0
          ? 'CONFIG_INCOMPLETE'
          : mode === 'production'
            ? 'LIVE_CONFIGURED'
            : 'CONFIGURED',
      enabled,
      configured: enabled && missingConfiguration.length === 0,
      mode,
      supportedCurrencies: ['USD', 'EUR', 'EGP'],
      missingConfiguration,
    };
  }

  async createSession(
    input: CreateCheckoutSessionData,
  ): Promise<CheckoutSessionData> {
    this.assertConfigured();
    const [firstName, ...lastNameParts] = input.customer.fullName
      .trim()
      .split(/\s+/);
    const lastName = lastNameParts.join(' ') || firstName;
    const country = input.customer.country?.trim().toUpperCase();
    const hasCountry = Boolean(country && /^[A-Z]{2}$/.test(country));

    const checkout = await this.wrapProviderCall(() =>
      this.client().invoices.create(
        {
          firstName,
          lastName,
          email: input.customer.email,
          orderTitle: `Dunas booking ${input.referenceCode}`,
          orderAmount: input.amount,
          currency: input.currency,
          ...(hasCountry
            ? {
                country,
                address: input.customer.address || '',
                city: input.customer.city || '',
                state: input.customer.state || '',
              }
            : {}),
          redirectionUrl: this.requireUrl('GETPAYIN_REDIRECT_URL'),
          webhookUrl: this.requireUrl('GETPAYIN_WEBHOOK_URL'),
          orderDetails: JSON.stringify([
            { label: 'Booking Reference', value: input.referenceCode },
            { label: 'Payment ID', value: input.paymentId },
          ]),
        },
        { idempotencyKey: this.toProviderIdempotencyKey(input.idempotencyKey) },
      ),
    );

    const checkoutUrl = new URL(checkout.checkoutUrl);
    const expectedOrigin = new URL(this.baseUrl()).origin;
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.origin !== expectedOrigin) {
      throw new ServiceUnavailableException(
        'PayLink returned an untrusted checkout URL',
      );
    }
    const expiresAt = new Date(checkout.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw new ServiceUnavailableException(
        'PayLink returned an invalid checkout expiration',
      );
    }

    return {
      url: checkoutUrl.toString(),
      providerInvoiceId: String(checkout.invoiceId),
      expiresAt,
    };
  }

  async verifyAndParseWebhook(
    _req: Request,
    rawBody: Buffer,
  ): Promise<WebhookPayload> {
    this.assertConfigured();
    let verified;
    try {
      verified = this.client().webhooks.verify(rawBody.toString('utf8'));
    } catch (error) {
      if (error instanceof PaylinkSignatureError) {
        this.logger.error('CRITICAL SECURITY ALERT: PayLink webhook signature verification failed');
        throw new BadRequestException('Invalid PayLink webhook signature');
      }
      throw error;
    }

    const contract = PAYLINK_EVENTS.get(verified.event);
    const providerStatus = verified.invoiceStatus?.toUpperCase() as
      | WebhookPayload['providerStatus']
      | undefined;
    if (
      !contract ||
      !verified.invoiceId ||
      !Number.isSafeInteger(verified.invoiceId) ||
      !providerStatus ||
      !contract.statuses.includes(providerStatus)
    ) {
      throw new BadRequestException('Unsupported or inconsistent PayLink event');
    }

    const rawSignature = String(verified.raw.signature || '');
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        [
          this.getProviderName(),
          verified.invoiceId,
          verified.event,
          providerStatus,
          rawSignature,
        ].join('|'),
      )
      .digest('hex');

    return {
      eventId: `paylink:${fingerprint}`,
      event: verified.event,
      providerInvoiceId: String(verified.invoiceId),
      providerStatus,
      status:
        providerStatus === 'PARTIALLY_REFUNDED'
          ? 'PARTIALLY_REFUNDED'
          : contract.mapped,
      rawEvent: verified.raw,
    };
  }

  async refund(
    _providerInvoiceId: string,
    _amount: string,
    _idempotencyKey: string,
  ): Promise<GatewayRefundResult> {
    throw new BadRequestException(
      'Online payment gateway refunds are disabled. All refunds are processed offline directly by company finance.',
    );
  }

  async checkStatus(providerInvoiceId: string): Promise<GatewayPaymentStatus> {
    this.assertConfigured();
    const result = await this.wrapProviderCall(() =>
      this.client().payments.checkStatus({
        invoiceId: this.invoiceId(providerInvoiceId),
      }),
    );
    return {
      providerInvoiceId: String(result.invoiceId),
      providerStatus: result.paidStatus,
      authCode: result.authCode,
    };
  }

  verifyCallback(payload: PayLinkCallbackPayload): string {
    this.assertConfigured();
    const providerInvoiceId = String(payload.invoice_id);
    this.invoiceId(providerInvoiceId);
    const providerStatus = String(payload.invoice_status).toUpperCase();

    const rawSig = String(payload.signature || '').trim();
    if (!rawSig || rawSig.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/.test(rawSig)) {
      this.logger.error(
        `CRITICAL SECURITY ALERT: Malformed PayLink browser callback signature encoding for invoice_id=${providerInvoiceId}`,
      );
      throw new BadRequestException('Invalid PayLink callback signature');
    }

    const supplied = Buffer.from(rawSig, 'base64');
    if (supplied.toString('base64') !== rawSig) {
      this.logger.error(
        `CRITICAL SECURITY ALERT: Non-canonical or re-padded PayLink callback signature for invoice_id=${providerInvoiceId}`,
      );
      throw new BadRequestException('Invalid PayLink callback signature');
    }

    const expected = crypto
      .createHmac('sha256', this.hashToken())
      .update(
        `${this.normalizeSuccess(payload.success)}${providerInvoiceId}${providerStatus}${String(payload.message)}`,
      )
      .digest();
    if (
      supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)
    ) {
      this.logger.error(
        `CRITICAL SECURITY ALERT: Invalid PayLink browser callback signature detected for invoice_id=${providerInvoiceId}`,
      );
      throw new BadRequestException('Invalid PayLink callback signature');
    }
    return providerInvoiceId;
  }

  async expireSession(_providerInvoiceId: string): Promise<void> {
    // PayLink has no endpoint for expiring an unpaid hosted checkout. Dunas
    // expires its local payment and seat hold using the provider expires_at.
  }

  private client(): PaylinkClient {
    return new PaylinkClient({
      publicToken: this.authToken(),
      hashToken: this.hashToken(),
      baseUrl: this.baseUrl(),
      timeoutMs: this.configService.get<number>('GETPAYIN_TIMEOUT_MS') ?? 30_000,
      maxRetries: this.configService.get<number>('GETPAYIN_MAX_RETRIES') ?? 2,
    });
  }

  private assertConfigured(): void {
    const readiness = this.getReadiness();
    if (!readiness.configured) {
      throw new ServiceUnavailableException(
        `PayLink is not configured: ${readiness.missingConfiguration.join(', ')}`,
      );
    }
  }

  private authToken(): string {
    return this.value('GETPAYIN_AUTH_TOKEN') || this.value('GETPAYIN_API_KEY');
  }

  private hashToken(): string {
    return (
      this.value('GETPAYIN_HASH_TOKEN') ||
      this.value('GETPAYIN_WEBHOOK_SECRET')
    );
  }

  private baseUrl(): string {
    return (
      this.value('GETPAYIN_BASE_URL') ||
      this.value('GETPAYIN_API_BASE_URL') ||
      PAYLINK_DEFAULT_BASE_URL
    ).replace(/\/$/, '');
  }

  private value(key: string): string {
    return this.configService.get<string>(key)?.trim() || '';
  }

  private requireUrl(key: string): string {
    const parsed = new URL(this.value(key));
    if (parsed.protocol !== 'https:') {
      throw new ServiceUnavailableException(`${key} must use HTTPS`);
    }
    return parsed.toString();
  }

  private invoiceId(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('Invalid PayLink invoice ID');
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('Invalid PayLink invoice ID');
    }
    return parsed;
  }

  private normalizeSuccess(value: string | number | boolean): string {
    if (value === true || value === 1 || value === '1') return '1';
    if (value === false || value === 0 || value === '0') return '0';
    const normalized = String(value).toLowerCase();
    if (normalized === 'true') return 'true';
    if (normalized === 'false') return 'false';
    throw new BadRequestException('Invalid PayLink callback success value');
  }

  private toProviderIdempotencyKey(value: string): string {
    return value.length <= 64
      ? value
      : `dunas:${crypto.createHash('sha256').update(value).digest('hex').slice(0, 58)}`;
  }

  private async wrapProviderCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PaylinkConnectionError) {
        this.logger.error(`GATEWAY OUTAGE ALERT: PayLink connection failure or timeout: ${error.message}`);
        throw new ServiceUnavailableException('PayLink is temporarily unavailable');
      }
      if (error instanceof PaylinkApiError) {
        if (error.status === 401 || error.status === 403) {
          this.logger.error(
            `PayLink authentication/credential error: status=${error.status} message=${error.message}`,
          );
          throw new ServiceUnavailableException(
            'PayLink authentication or configuration failed',
          );
        }
        if (error.status === 400 || error.status === 422) {
          throw new BadRequestException(
            error.message || 'PayLink rejected invalid payment parameters',
          );
        }
        if (error.status === 429) {
          throw new ServiceUnavailableException(
            'PayLink rate limit exceeded; please retry shortly',
          );
        }
        throw new ServiceUnavailableException(
          error.isIdempotencyConflict
            ? 'PayLink rejected conflicting idempotency data'
            : 'PayLink rejected the payment operation',
        );
      }
      throw error;
    }
  }
}
