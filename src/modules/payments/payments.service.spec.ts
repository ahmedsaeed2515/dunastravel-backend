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
              create: jest.fn(),
              update: jest.fn(),
            },
            refundRecord: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
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
            getProviderName: jest.fn().mockReturnValue('STRIPE'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
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
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockBooking as never);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-123',
        url: 'https://checkout.stripe.com/123',
      });
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as never);

      const result = await service.initiatePayment('bkg-123', 'usr-123');

      expect(result.url).toBe('https://checkout.stripe.com/123');
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
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockGuestBooking as never);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-guest',
        url: 'https://checkout.stripe.com/guest',
      });
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({} as never);

      const result = await service.initiatePayment(
        'bkg-guest',
        undefined,
        rawToken,
      );

      expect(result.url).toBe('https://checkout.stripe.com/guest');
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

    it('should expire orphan Stripe session when P2002 race condition occurs', async () => {
      const mockRaceBooking = {
        id: 'bkg-race',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        referenceCode: 'REF-RACE',
        userId: 'usr-123',
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockRaceBooking as never);

      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          sessionUrl: 'https://checkout.stripe.com/winning',
          transactionId: 'session-winning',
        } as never);

      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-losing',
        url: 'https://checkout.stripe.com/losing',
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
      expect(result.url).toBe('https://checkout.stripe.com/winning');
    });
  });

  describe('handleWebhook', () => {
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
        method: 'STRIPE',
        transactionId: 'session-123',
        status: 'PENDING',
        createdAt: new Date(),
        bookingId: 'bkg-123',
      } as never);

      const reqMock = { headers: {} } as unknown as import('express').Request;
      await expect(
        service.handleWebhook(reqMock, Buffer.from('')),
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
      const result = await service.handleWebhook(reqMock, Buffer.from(''));

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

      await expect(service.refundPayment('payment-123', 50)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should issue full refund, record RefundRecord, and update status atomically', async () => {
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
        id: 'payment-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'STRIPE',
        transactionId: 'tx-123',
        status: 'CAPTURED',
        bookingId: 'bkg-123',
        booking: {
          id: 'bkg-123',
          adults: 1,
          children: 0,
          availabilityId: null,
        },
        invoices: [{ id: 'inv-123' }],
      } as never);

      jest.spyOn(prisma.refundRecord, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(prisma.refundRecord, 'create')
        .mockResolvedValue({ id: 'rf-rec-1' } as never);
      jest
        .spyOn(gatewayMock, 'refund')
        .mockResolvedValue({ refundId: 'rf-stripe-123' });

      const result = await service.refundPayment('payment-123', 100);

      expect(result.success).toBe(true);
      expect(
        (gatewayMock.refund as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
      expect(
        (prisma.payment.update as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });
  });
});
