import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrevoEmailProvider } from './brevo-email.provider';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';

describe('BrevoEmailProvider', () => {
  let provider: BrevoEmailProvider;
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;

    const configService = {
      get: jest.fn((key: string) => {
        if (
          key === 'mail.apiKey' ||
          key === 'mail.brevoApiKey' ||
          key === 'BREVO_API_KEY'
        ) {
          return 'xkeysib-mock-api-key-1234567890';
        }
        if (key === 'mail.fromAddress') return 'info@dunastravel.com';
        if (key === 'mail.fromName') return 'Dunas Travel';
        if (key === 'nodeEnv') return 'test';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrevoEmailProvider,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    provider = module.get<BrevoEmailProvider>(BrevoEmailProvider);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('Brevo API Dispatch & Success', () => {
    it('should successfully send an email to Brevo API and return SUCCESS result', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          messageId: '<brevo-msg-id-12345@smtp-relay.brevo.com>',
        }),
      });

      const payload = {
        to: 'guest@example.com',
        subject: 'Your Booking Confirmation',
        html: '<p>Booking Confirmed</p>',
        text: 'Booking Confirmed',
        replyTo: 'support@dunastravel.com',
        tags: { type: 'booking_confirmation' },
      };

      const result = await provider.send(payload);

      expect(result.status).toBe('SUCCESS');
      expect(result.success).toBe(true);
      expect(result.providerMessageId).toBe(
        '<brevo-msg-id-12345@smtp-relay.brevo.com>',
      );
      expect(result.sentAt).toBeInstanceOf(Date);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, request] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(request.method).toBe('POST');
      expect(request.headers['api-key']).toBe(
        'xkeysib-mock-api-key-1234567890',
      );
      expect(request.headers['accept']).toBe('application/json');
      expect(request.headers['content-type']).toBe('application/json');

      const body = JSON.parse(request.body);
      expect(body.sender.email).toBe('info@dunastravel.com');
      expect(body.sender.name).toBe('Dunas Travel');
      expect(body.to).toEqual([{ email: 'guest@example.com' }]);
      expect(body.subject).toBe('Your Booking Confirmation');
      expect(body.htmlContent).toBe('<p>Booking Confirmed</p>');
      expect(body.textContent).toBe('Booking Confirmed');
      expect(body.replyTo).toEqual({ email: 'support@dunastravel.com' });
      expect(body.tags).toEqual(['type_booking_confirmation']);
      expect(body.headers['Idempotency-Key']).toMatch(/^dunas-[a-f0-9]{64}$/);
    });

    it('should respect custom idempotencyKey when supplied in payload', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'brevo-msg-custom-idemp' }),
      });

      const customKey = 'dunas-test-custom-key-999';
      await provider.send({
        to: 'guest@example.com',
        subject: 'Custom Idempotency Test',
        html: '<p>Test</p>',
        text: 'Test',
        idempotencyKey: customKey,
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.headers['Idempotency-Key']).toBe(customKey);
    });
  });

  describe('Error Classification & Resilience', () => {
    it('should classify 400, 401, 403, 404, 422 as permanent errors (isTransient: false)', async () => {
      const permanentStatuses = [400, 401, 403, 404, 422];

      for (const status of permanentStatuses) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Client Error',
          json: async () => ({
            code: 'invalid_parameter',
            message: `Validation failed with status ${status}`,
          }),
        });

        try {
          await provider.send({
            to: 'invalid-email',
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test',
          });
          fail(`Expected status ${status} to throw EmailDeliveryException`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(EmailDeliveryException);
          expect(err.statusCode).toBe(status);
          expect(err.isTransient).toBe(false);
        }
      }
    });

    it('should classify 429 rate limits and 5xx server errors as transient (isTransient: true)', async () => {
      const transientStatuses = [429, 500, 502, 503, 504];

      for (const status of transientStatuses) {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Server Error',
          json: async () => ({
            code: 'service_unavailable',
            message: `Transient error ${status}`,
          }),
        });

        try {
          await provider.send({
            to: 'guest@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
            text: 'Test',
          });
          fail(`Expected status ${status} to throw EmailDeliveryException`);
        } catch (err: any) {
          expect(err).toBeInstanceOf(EmailDeliveryException);
          expect(err.statusCode).toBe(status);
          expect(err.isTransient).toBe(true);
        }
      }
    });

    it('should classify network drop and fetch errors as transient (isTransient: true)', async () => {
      fetchMock.mockRejectedValueOnce(
        new TypeError('fetch failed: getaddrinfo ENOTFOUND api.brevo.com'),
      );

      try {
        await provider.send({
          to: 'guest@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        });
        fail('Expected network error to throw EmailDeliveryException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmailDeliveryException);
        expect(err.isTransient).toBe(true);
        expect(err.message).toContain('ENOTFOUND');
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should fail closed in production if API key is missing', () => {
      const prodConfigWithoutKey = {
        get: jest.fn((key: string) => {
          if (key === 'nodeEnv') return 'production';
          if (key === 'mail.fromAddress') return 'info@dunastravel.com';
          return undefined;
        }),
      };

      expect(() => new BrevoEmailProvider(prodConfigWithoutKey as any)).toThrow(
        /Production Brevo API Key is required/i,
      );
    });

    it('should fail closed in production if sender address is missing', () => {
      const prodConfigWithoutSender = {
        get: jest.fn((key: string) => {
          if (key === 'nodeEnv') return 'production';
          if (key === 'mail.apiKey') return 'xkeysib-some-key';
          return undefined;
        }),
      };

      expect(
        () => new BrevoEmailProvider(prodConfigWithoutSender as any),
      ).toThrow(/Production email sender address is required/i);
    });
  });
});
