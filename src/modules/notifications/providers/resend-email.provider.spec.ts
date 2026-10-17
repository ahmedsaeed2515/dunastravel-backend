import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ResendEmailProvider } from './resend-email.provider';
import { EmailDeliveryException } from '../exceptions/email-delivery.exception';
import { EmailDeliveryService } from '../services/email-delivery.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EMAIL_PROVIDER_TOKEN } from './email-provider.interface';
import { NotificationType } from '../types';

describe('ResendEmailProvider & EmailDeliveryService Hardening', () => {
  let provider: ResendEmailProvider;
  let mockResendInstance: {
    emails: {
      send: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({
          data: { id: 'resend-msg-123' },
          error: null,
        }),
      },
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'mail.apiKey') return 're_1234567890';
        if (key === 'mail.fromAddress') return 'info@dunastravel.com';
        if (key === 'mail.fromName') return 'Dunas Travel';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendEmailProvider,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    provider = module.get<ResendEmailProvider>(ResendEmailProvider);
    (provider as any).resend = mockResendInstance;
  });

  describe('Resend Idempotency & Sending', () => {
    it('should include Idempotency-Key header on email send', async () => {
      const payload = {
        to: 'guest@example.com',
        subject: 'Booking Confirmation',
        html: '<p>Confirmed</p>',
        text: 'Confirmed',
        idempotencyKey: 'custom-idempotency-key-xyz',
      };

      const result = await provider.send(payload);

      expect(result.status).toBe('SUCCESS');
      expect(result.providerMessageId).toBe('resend-msg-123');
      expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@example.com',
          headers: {
            'Idempotency-Key': 'custom-idempotency-key-xyz',
          },
        }),
        expect.objectContaining({
          headers: {
            'Idempotency-Key': 'custom-idempotency-key-xyz',
          },
        }),
      );
    });

    it('should generate deterministic Idempotency-Key if not explicitly provided', async () => {
      const payload = {
        to: 'guest@example.com',
        subject: 'Welcome to Dunas',
        html: '<p>Welcome</p>',
        text: 'Welcome',
      };

      await provider.send(payload);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Idempotency-Key': expect.stringMatching(/^dunas-[a-f0-9]{64}$/),
          },
        }),
        expect.anything(),
      );
    });
  });

  describe('Error Classification & Transient Detection', () => {
    it('should classify 400/422 validation errors as non-transient (isTransient: false)', async () => {
      mockResendInstance.emails.send.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'validation_error',
          message: 'The email address is invalid',
          statusCode: 422,
        },
      });

      const payload = {
        to: 'invalid-email',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      try {
        await provider.send(payload);
        fail('Expected EmailDeliveryException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmailDeliveryException);
        expect(err.isTransient).toBe(false);
        expect(err.statusCode).toBe(422);
      }
    });

    it('should classify 500 server errors or 429 rate limits as transient (isTransient: true)', async () => {
      mockResendInstance.emails.send.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'rate_limit_exceeded',
          message: 'Rate limit exceeded',
          statusCode: 429,
        },
      });

      const payload = {
        to: 'guest@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      };

      try {
        await provider.send(payload);
        fail('Expected EmailDeliveryException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmailDeliveryException);
        expect(err.isTransient).toBe(true);
      }
    });
  });

  describe('EmailDeliveryService Retry Behavior', () => {
    it('should immediately abort retry loop without sleeping on non-transient failure', async () => {
      const mockAdapter = {
        send: jest
          .fn()
          .mockRejectedValue(
            new EmailDeliveryException(
              'Invalid email format',
              'validation_error',
              422,
              false,
            ),
          ),
      };

      const mockPrisma = {
        notificationDeliveryLog: {
          create: jest.fn().mockResolvedValue({ id: 'log-1' }),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const deliveryService = new EmailDeliveryService(
        mockAdapter,
        mockPrisma as unknown as PrismaService,
      );

      const success = await deliveryService.deliver(
        NotificationType.USER_VERIFICATION,
        'usr-1',
        'User',
        {
          to: 'bad-email',
          subject: 'Test',
          html: '',
          text: '',
        },
      );

      expect(success).toBe(false);
      // Verify send was called only ONCE and did not perform 3 retries
      expect(mockAdapter.send).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notificationDeliveryLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'EXHAUSTED',
            attempts: 1,
          }),
        }),
      );
    });
  });
});
