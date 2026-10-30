import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { GetPayInGatewayAdapter } from './getpayin-gateway.adapter';

describe('GetPayInGatewayAdapter (real PayLink contract)', () => {
  const values: Record<string, unknown> = {
    'payments.provider': 'GETPAYIN',
    GETPAYIN_MODE: 'sandbox',
    GETPAYIN_BASE_URL: 'https://pay.getpayin.com',
    GETPAYIN_AUTH_TOKEN: 'auth-token',
    GETPAYIN_HASH_TOKEN: 'hash-token',
    GETPAYIN_REDIRECT_URL: 'https://dunas-travel.com/payment/return',
    GETPAYIN_WEBHOOK_URL:
      'https://api.dunas-travel.com/api/payments/webhook/getpayin',
    GETPAYIN_MAX_RETRIES: 0,
    GETPAYIN_TIMEOUT_MS: 5000,
  };

  const config = (overrides: Record<string, unknown> = {}) =>
    ({
      get: jest.fn((key: string) => ({ ...values, ...overrides })[key]),
    }) as unknown as ConfigService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports only real missing PayLink settings and never their values', () => {
    const adapter = new GetPayInGatewayAdapter(
      config({ GETPAYIN_AUTH_TOKEN: '', GETPAYIN_HASH_TOKEN: '' }),
    );
    const readiness = adapter.getReadiness();

    expect(readiness).toEqual(
      expect.objectContaining({
        provider: 'GETPAYIN',
        enabled: true,
        configured: false,
        mode: 'sandbox',
        supportedCurrencies: ['USD', 'EUR', 'EGP'],
      }),
    );
    expect(readiness.missingConfiguration).toEqual([
      'GETPAYIN_AUTH_TOKEN',
      'GETPAYIN_HASH_TOKEN',
    ]);
    expect(JSON.stringify(readiness)).not.toContain('auth-token');
  });

  it('maps hosted checkout through SDK v2 with exact amount and idempotency', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        expect(String(_url)).toBe(
          'https://pay.getpayin.com/api/v2/integration/init',
        );
        const body = JSON.parse(String(init?.body)) as Record<string, string>;
        expect(body).toEqual(
          expect.objectContaining({
            token: 'auth-token',
            first_name: 'Ahmed',
            last_name: 'Saeed',
            order_amount: '250.00',
            currency: 'USD',
            redirection_url: 'https://dunas-travel.com/payment/return',
            webhook_url:
              'https://api.dunas-travel.com/api/payments/webhook/getpayin',
          }),
        );
        // BUG-4: order_details must be a valid JSON array of {label,value} objects
        expect(() => JSON.parse(body.order_details)).not.toThrow();
        const details = JSON.parse(body.order_details) as Array<{
          label: string;
          value: string;
        }>;
        expect(Array.isArray(details)).toBe(true);
        expect(
          details.some(
            (d) => d.label === 'Booking Reference' && d.value === 'DUNAS-1',
          ),
        ).toBe(true);
        expect(
          details.some(
            (d) => d.label === 'Payment ID' && d.value === 'payment-1',
          ),
        ).toBe(true);
        expect(body.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'checkout:payment-1',
        );
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              checkout_url:
                'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
              invoice_id: 40506,
              expires_at: '2026-08-30T12:30:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      });
    const adapter = new GetPayInGatewayAdapter(config());

    await expect(
      adapter.createSession({
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        referenceCode: 'DUNAS-1',
        amount: '250.00',
        currency: 'USD',
        customer: {
          fullName: 'Ahmed Saeed',
          email: 'ahmed@example.com',
          phone: '+201000000000',
          country: 'EG',
          address: 'Cairo',
          city: 'Cairo',
        },
        idempotencyKey: 'checkout:payment-1',
      }),
    ).resolves.toEqual({
      url: 'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
      providerInvoiceId: '40506',
      expiresAt: new Date('2026-08-30T12:30:00.000Z'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects checkout URLs outside the configured PayLink origin', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            checkout_url: 'https://evil.example/checkout',
            invoice_id: 40506,
            expires_at: '2026-08-30T12:30:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const adapter = new GetPayInGatewayAdapter(config());

    await expect(
      adapter.createSession({
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        referenceCode: 'DUNAS-1',
        amount: '250.00',
        currency: 'USD',
        customer: {
          fullName: 'Ahmed Saeed',
          email: 'ahmed@example.com',
          phone: '',
        },
        idempotencyKey: 'checkout:payment-1',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('verifies body signature and builds lifecycle-aware replay fingerprint', async () => {
    const body = {
      event: 'invoice.paid',
      event_triggered_at: '2026-07-22T13:46:06+00:00',
      timezone: 'UTC',
      success: 1,
      invoice_id: 40506,
      invoice_status: 'PAID',
      message: 'Invoice Paid',
      signature: crypto
        .createHmac('sha256', 'hash-token')
        .update('140506PAIDInvoice Paid')
        .digest('base64'),
    };
    const adapter = new GetPayInGatewayAdapter(config());

    const parsed = await adapter.verifyAndParseWebhook(
      {} as never,
      Buffer.from(JSON.stringify(body)),
    );
    expect(parsed).toEqual(
      expect.objectContaining({
        event: 'invoice.paid',
        providerInvoiceId: '40506',
        providerStatus: 'PAID',
        status: 'COMPLETED',
        eventId: expect.stringMatching(/^paylink:[a-f0-9]{64}$/),
      }),
    );
  });

  it('rejects invalid webhook signatures without returning provider data', async () => {
    const adapter = new GetPayInGatewayAdapter(config());
    await expect(
      adapter.verifyAndParseWebhook(
        {} as never,
        Buffer.from(
          JSON.stringify({
            event: 'invoice.paid',
            success: 1,
            invoice_id: 40506,
            invoice_status: 'PAID',
            message: 'Invoice Paid',
            signature: 'invalid',
          }),
        ),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('verifies the signed browser callback with a timing-safe server check', () => {
    const adapter = new GetPayInGatewayAdapter(config());
    const signature = crypto
      .createHmac('sha256', 'hash-token')
      .update('140506PAIDInvoice Paid')
      .digest('base64');

    expect(
      adapter.verifyCallback({
        success: 1,
        invoice_id: 40506,
        invoice_status: 'PAID',
        message: 'Invoice Paid',
        signature,
      }),
    ).toBe('40506');
    expect(() =>
      adapter.verifyCallback({
        success: 1,
        invoice_id: 40506,
        invoice_status: 'PAID',
        message: 'Invoice Paid',
        signature: 'invalid',
      }),
    ).toThrow(BadRequestException);
  });

  it('maps PayLink check-status and partial-refund responses without inventing IDs', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.token).toBe('auth-token');
      expect(body.invoice_id).toBe('40506');
      expect(body.signature).toEqual(expect.any(String));
      if (path.endsWith('/check-status')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              invoice_id: 40506,
              paid_status: 'PAID',
              auth_code: '831000',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      expect(path).toBe('/api/integration/refund');
      expect(body.amount).toBe('50.00');
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
        'refund:1',
      );
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            invoice_id: 40506,
            paid_status: 'PARTIALLY_REFUNDED',
            auth_code: '831000',
            refund_amount: '50.00',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const adapter = new GetPayInGatewayAdapter(config());

    await expect(adapter.checkStatus('40506')).resolves.toEqual({
      providerInvoiceId: '40506',
      providerStatus: 'PAID',
      authCode: '831000',
    });
    await expect(adapter.refund('40506', '50.00', 'refund:1')).rejects.toThrow(
      'Online payment gateway refunds are disabled. All refunds are processed offline directly by company finance.',
    );
  });
});
