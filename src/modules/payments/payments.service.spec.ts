import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { CommissionsService } from '../commissions/commissions.service';
import { ConfigService } from '@nestjs/config';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let gatewayMock: IPaymentGatewayPort;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest
              .fn()
              .mockImplementation(
                async (
                  cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
                ) => cb(prisma),
              ),
            booking: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            processedWebhookEvent: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            payment: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            refundRecord: {
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            invoice: {
              update: jest.fn(),
            },
            bookingActivityLog: {
              create: jest.fn(),
            },
            promotionRedemption: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            promotion: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            tourAvailability: {
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            analyticsEvent: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: IPaymentGatewayPort,
          useValue: {
            createSession: jest.fn(),
            verifyAndParseWebhook: jest.fn(),
            refund: jest.fn(),
            expireSession: jest.fn(),
            getProviderName: jest.fn().mockReturnValue('GETPAYIN'),
            getReadiness: jest.fn().mockReturnValue({
              provider: 'GETPAYIN',
              enabled: false,
              configured: false,
              mode: 'sandbox',
              supportedCurrencies: ['USD'],
              missingConfiguration: [],
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: CommissionsService,
          useValue: {
            createCommissionForBooking: jest.fn().mockResolvedValue(null),
            reverseCommissionForBooking: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'frontendUrl'
                ? 'https://www.dunastravel.com'
                : 'https://api.example.test',
            ),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    gatewayMock = module.get<IPaymentGatewayPort>(IPaymentGatewayPort);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    it('should allow owner initiation and return session', async () => {
      const mockBooking = {
        id: 'bkg-123',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        referenceCode: 'REF-123',
        userId: 'usr-123',
        guestTokenHash: null,
        tour: { currency: 'USD' },
        invoice: {
          currency: 'USD',
          total: new Prisma.Decimal(100),
        },
        billingInfo: {
          fullName: 'Test Customer',
          email: 'test@example.com',
          phone: '+201000000000',
        },
        payments: [],
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockBooking as never);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-123',
        url: 'https://hosted.getpayin.example/123',
      });
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as never);

      const result = await service.initiatePayment('bkg-123', 'usr-123');

      expect(result.url).toBe('https://hosted.getpayin.example/123');
      expect(gatewayMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'bkg-123',
          referenceCode: 'REF-123',
          amount: 100,
          currency: 'USD',
          successUrl: expect.stringMatching(
            /^https:\/\/www\.dunastravel\.com\/payment\/return\?payment_id=[0-9a-f-]+$/,
          ),
          cancelUrl: expect.stringContaining('/payment/cancel?payment_id='),
          webhookUrl: 'https://api.example.test/api/payments/webhook/getpayin',
        }),
      );
      expect(
        (prisma.payment.create as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('should allow guest token initiation when guest token matches hash', async () => {
      const rawToken = 'valid-guest-secret-token';
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const mockGuestBooking = {
        id: 'bkg-guest',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(150),
        referenceCode: 'REF-GUEST',
        userId: null,
        guestTokenHash: tokenHash,
        tour: { currency: 'USD' },
        invoice: {
          currency: 'USD',
          total: new Prisma.Decimal(150),
        },
        billingInfo: {
          fullName: 'Guest Customer',
          email: 'guest@example.com',
          phone: '+201000000001',
        },
        payments: [],
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockGuestBooking as never);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-guest',
        url: 'https://hosted.getpayin.example/guest',
      });
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as never);

      const result = await service.initiatePayment(
        'bkg-guest',
        undefined,
        rawToken,
      );

      expect(result.url).toBe('https://hosted.getpayin.example/guest');
    });

    it('should throw NotFoundException (404) for foreign user initiation without leaking existence', async () => {
      const mockForeignBooking = {
        id: 'bkg-123',
        userId: 'owner-id',
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockForeignBooking as never);

      await expect(
        service.initiatePayment('bkg-123', 'foreign-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('expires an orphan hosted-checkout session when a concurrent request wins', async () => {
      const mockRaceBooking = {
        id: 'bkg-race',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        referenceCode: 'REF-RACE',
        userId: 'usr-123',
        tour: { currency: 'USD' },
        invoice: {
          currency: 'USD',
          total: new Prisma.Decimal(100),
        },
        billingInfo: {
          fullName: 'Race Customer',
          email: 'race@example.com',
          phone: '+201000000002',
        },
        payments: [],
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockRaceBooking as never);

      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          sessionUrl: 'https://hosted.getpayin.example/winning',
          transactionId: 'session-winning',
        } as never);

      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-losing',
        url: 'https://hosted.getpayin.example/losing',
      });

      const p2002Err = new Error('Unique constraint failed') as {
        code?: string;
      };
      p2002Err.code = 'P2002';
      jest.spyOn(prisma.payment, 'create').mockRejectedValue(p2002Err);

      const result = await service.initiatePayment('bkg-race', 'usr-123');

      expect((gatewayMock.expireSession as jest.Mock).mock.calls).toEqual([
        ['session-losing'],
      ]);
      expect(result.url).toBe('https://hosted.getpayin.example/winning');
    });
  });

  describe('handleWebhook', () => {
    it('rejects a webhook route that does not match the active provider', async () => {
      const reqMock = { headers: {} } as unknown as import('express').Request;

      await expect(
        service.handleWebhook('UNSUPPORTED_PROVIDER', reqMock, Buffer.from('{}')),
      ).rejects.toThrow(NotFoundException);
      expect(gatewayMock.verifyAndParseWebhook).not.toHaveBeenCalled();
    });

    it('marks a matching open payment as failed and keeps the booking retryable', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'evt-failed-1',
        paymentId: 'provider-payment-1',
        bookingId: 'bkg-123',
        amountUsd: 100,
        currency: 'USD',
        status: 'FAILED',
        rawEvent: {},
      });
      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue({
        id: 'payment-1',
        bookingId: 'bkg-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        transactionId: 'provider-payment-1',
        status: 'PENDING',
        isRefund: false,
        createdAt: new Date(),
      } as never);

      await expect(
        service.handleWebhook(
          'GETPAYIN',
          { headers: {} } as unknown as import('express').Request,
          Buffer.from('{}'),
        ),
      ).resolves.toEqual({ received: true });

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          failedAt: expect.any(Date),
        }),
      });
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('should reject webhook with amount mismatch', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'evt-mismatch',
        paymentId: 'session-123',
        bookingId: 'bkg-123',
        amountUsd: 999, // Mismatched amount
        currency: 'USD',
        status: 'COMPLETED',
        rawEvent: {},
      });

      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        id: 'bkg-123',
        totalAmountUsd: new Prisma.Decimal(100),
      } as never);

      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue({
        id: 'pmt-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        transactionId: 'session-123',
        status: 'PENDING',
        createdAt: new Date(),
        bookingId: 'bkg-123',
      } as never);

      const reqMock = { headers: {} } as unknown as import('express').Request;
      await expect(
        service.handleWebhook('GETPAYIN', reqMock, Buffer.from('')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should gracefully handle duplicate eventId without re-processing', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'dup-123',
        paymentId: 'session-123',
        bookingId: 'bkg-123',
        amountUsd: 100,
        currency: 'USD',
        status: 'COMPLETED',
        rawEvent: {},
      });

      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue({ id: 'dup-123' } as never);

      const reqMock = { headers: {} } as unknown as import('express').Request;
      const result = await service.handleWebhook(
        'GETPAYIN',
        reqMock,
        Buffer.from(''),
      );

      expect(result).toEqual({ received: true });
      expect((prisma.booking.update as jest.Mock).mock.calls.length).toBe(0);
    });
  });

  describe('refundPayment', () => {
    it('should reject partial refunds explicitly', async () => {
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
        id: 'payment-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        status: 'CAPTURED',
        bookingId: 'bkg-123',
        invoices: [],
      } as never);

      await expect(
        service.refundPayment(
          'payment-123',
          50,
          'partial refund test',
          'refund-partial-1',
          { id: 'super-admin-1', role: 'SUPER_ADMIN' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should issue full refund, record RefundRecord, and update status atomically', async () => {
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
        id: 'payment-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        transactionId: 'tx-123',
        status: 'CAPTURED',
        bookingId: 'bkg-123',
        booking: {
          id: 'bkg-123',
          status: 'CONFIRMED',
          totalAmountUsd: new Prisma.Decimal(100),
          paidAmountUsd: new Prisma.Decimal(100),
          adults: 1,
          children: 0,
          availabilityId: null,
        },
        invoices: [{ id: 'inv-123' }],
      } as never);

      jest.spyOn(prisma.refundRecord, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.payment, 'findMany')
        .mockResolvedValue([
          { id: 'payment-123', amount: new Prisma.Decimal(100) },
        ] as never);
      jest.spyOn(prisma.refundRecord, 'create').mockResolvedValue({
        id: 'rf-rec-1',
        status: 'PENDING',
      } as never);
      jest
        .spyOn(gatewayMock, 'refund')
        .mockResolvedValue({ refundId: 'rf-getpayin-123' });

      const result = await service.refundPayment(
        'payment-123',
        100,
        'approved full refund',
        'refund-full-1',
        { id: 'super-admin-1', role: 'SUPER_ADMIN' },
      );

      expect(result.success).toBe(true);
      expect(
        (gatewayMock.refund as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
      expect(
        (prisma.payment.updateMany as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });
});
