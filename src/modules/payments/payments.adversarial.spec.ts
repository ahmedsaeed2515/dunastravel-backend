import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommissionsService } from '../commissions/commissions.service';
import { AvailabilityService } from '../availability/availability.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { GetPayInGatewayAdapter } from './adapters/getpayin-gateway.adapter';
import crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

describe('Adversarial Security & Systems Verification', () => {
  let service: PaymentsService;
  let adapter: GetPayInGatewayAdapter;
  let mockPrisma: any;
  let mockGateway: any;
  let mockCommissions: any;
  let configService: ConfigService;

  const TEST_HASH_TOKEN = 'test-secret-hash-token-1234567890';
  const TEST_AUTH_TOKEN = 'test-public-auth-token-1234567890';

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(mockPrisma)),
      payment: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      processedWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      bookingActivityLog: {
        create: jest.fn(),
      },
      refundRecord: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn(),
      },
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockGateway = {
      getProviderName: jest.fn().mockReturnValue('GETPAYIN'),
      getReadiness: jest.fn().mockReturnValue({
        provider: 'GETPAYIN',
        enabled: true,
        configured: true,
        mode: 'sandbox',
        supportedCurrencies: ['USD'],
        missingConfiguration: [],
      }),
      verifyAndParseWebhook: jest.fn(),
      refund: jest.fn(),
      checkStatus: jest.fn(),
    };

    mockCommissions = {
      createCommissionForBooking: jest.fn().mockResolvedValue(null),
      reverseCommissionForBooking: jest.fn().mockResolvedValue(null),
      adjustCommissionForPartialRefund: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        GetPayInGatewayAdapter,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IPaymentGatewayPort, useValue: mockGateway },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: CommissionsService, useValue: mockCommissions },
        {
          provide: AvailabilityService,
          useValue: {
            releaseCapacity: jest.fn().mockResolvedValue(undefined),
            reserveCapacity: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://example.com'),
            get: jest.fn((key: string) => {
              if (key === 'payments.provider') return 'GETPAYIN';
              if (key === 'GETPAYIN_HASH_TOKEN') return TEST_HASH_TOKEN;
              if (key === 'GETPAYIN_AUTH_TOKEN') return TEST_AUTH_TOKEN;
              if (key === 'GETPAYIN_REDIRECT_URL')
                return 'https://pay.getpayin.com/return';
              if (key === 'GETPAYIN_WEBHOOK_URL')
                return 'https://pay.getpayin.com/webhook';
              if (key === 'GETPAYIN_BASE_URL')
                return 'https://pay.getpayin.com';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    adapter = module.get<GetPayInGatewayAdapter>(GetPayInGatewayAdapter);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Out-of-order Webhook: invoice.refunded before invoice.paid', () => {
    it('successfully processes out-of-order invoice.refunded on PENDING payment and rejects subsequent invoice.paid', async () => {
      const mockPayment = {
        id: 'pay-1',
        bookingId: 'bkg-1',
        status: 'PENDING',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        provider: 'GETPAYIN',
        providerPaymentId: 'inv-999',
        transactionId: 'inv-999',
        isRefund: false,
      };

      const mockBooking = {
        id: 'bkg-1',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        paidAmountUsd: new Prisma.Decimal(0),
      };

      // 1. First webhook arrives: invoice.refunded
      mockGateway.verifyAndParseWebhook.mockResolvedValueOnce({
        eventId: 'paylink:event-refunded-1',
        event: 'invoice.refunded',
        providerInvoiceId: 'inv-999',
        providerStatus: 'REFUNDED',
        status: 'REFUNDED',
        paymentId: 'inv-999',
        bookingId: 'bkg-1',
        rawEvent: {},
      });

      mockPrisma.processedWebhookEvent.findUnique.mockResolvedValueOnce(null);
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      const refundWebhookResult = await service.handleWebhook(
        'GETPAYIN',
        {} as any,
        Buffer.from('{}'),
      );

      expect(refundWebhookResult).toEqual({ received: true });
      // Payment and Booking are transitioned to REFUNDED
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'REFUNDED', isRefund: true }),
      });
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'bkg-1' },
        data: expect.objectContaining({ status: 'REFUNDED' }),
      });

      // 2. Delayed second webhook arrives: invoice.paid
      mockGateway.verifyAndParseWebhook.mockResolvedValueOnce({
        eventId: 'paylink:event-paid-1',
        event: 'invoice.paid',
        providerInvoiceId: 'inv-999',
        providerStatus: 'PAID',
        status: 'COMPLETED',
        paymentId: 'inv-999',
        bookingId: 'bkg-1',
        amountUsd: 100,
        currency: 'USD',
        rawEvent: {},
      });

      mockPrisma.processedWebhookEvent.findUnique.mockResolvedValueOnce(null);
      // Booking is now in REFUNDED state
      mockPrisma.booking.findUnique.mockResolvedValueOnce({
        ...mockBooking,
        status: 'REFUNDED',
      });

      // Delayed capture attempt is strictly rejected
      await expect(
        service.handleWebhook('GETPAYIN', {} as any, Buffer.from('{}')),
      ).rejects.toThrow(
        'Cannot capture payment for booking in terminal status REFUNDED',
      );
    });
  });

  describe('HMAC Webhook Forgery & Edge Cases Verification', () => {
    function createValidSignedPayload(overrides: Record<string, any> = {}) {
      const payload: Record<string, any> = {
        event: 'invoice.paid',
        invoice_id: 12345,
        invoice_status: 'PAID',
        success: 1,
        message: 'Payment completed successfully',
        ...overrides,
      };

      const concatenated = [
        String(payload.success),
        String(payload.invoice_id),
        String(payload.invoice_status),
        String(payload.message),
      ].join('');

      payload.signature = crypto
        .createHmac('sha256', TEST_HASH_TOKEN)
        .update(concatenated, 'utf8')
        .digest('base64');

      return payload;
    }

    it('successfully verifies a genuinely signed PayLink webhook payload', async () => {
      const validPayload = createValidSignedPayload();
      const rawBody = Buffer.from(JSON.stringify(validPayload), 'utf8');

      const result = await adapter.verifyAndParseWebhook({} as any, rawBody);
      expect(result.status).toBe('COMPLETED');
      expect(result.providerInvoiceId).toBe('12345');
      expect(result.providerStatus).toBe('PAID');
    });

    it('rejects a forged signature with an altered amount or status', async () => {
      const validPayload = createValidSignedPayload();
      // Attacker tampers with invoice_status but keeps original signature
      validPayload.invoice_status = 'VOIDED';
      const rawBody = Buffer.from(JSON.stringify(validPayload), 'utf8');

      await expect(
        adapter.verifyAndParseWebhook({} as any, rawBody),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty raw body or non-JSON body', async () => {
      await expect(
        adapter.verifyAndParseWebhook({} as any, Buffer.from('', 'utf8')),
      ).rejects.toThrow();

      await expect(
        adapter.verifyAndParseWebhook(
          {} as any,
          Buffer.from('not json', 'utf8'),
        ),
      ).rejects.toThrow();
    });

    it('rejects a webhook with unsupported or inconsistent event/status pairing', async () => {
      // Create a valid HMAC on an illegal status pairing (e.g. event is invoice.paid but status is UNPAID)
      const inconsistentPayload = createValidSignedPayload({
        event: 'invoice.paid',
        invoice_status: 'UNPAID',
      });
      const rawBody = Buffer.from(JSON.stringify(inconsistentPayload), 'utf8');

      await expect(
        adapter.verifyAndParseWebhook({} as any, rawBody),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
