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
import { AvailabilityService } from '../availability/availability.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let gatewayMock: IPaymentGatewayPort;
  let module: import('@nestjs/testing').TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
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
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
            },
            processedWebhookEvent: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            payment: {
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
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
              aggregate: jest
                .fn()
                .mockResolvedValue({ _sum: { amount: null } }),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            invoice: {
              update: jest.fn(),
              updateMany: jest.fn(),
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
            checkStatus: jest.fn(),
            verifyCallback: jest.fn(),
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
            adjustCommissionForPartialRefund: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: AvailabilityService,
          useValue: {
            releaseCapacity: jest.fn().mockResolvedValue(undefined),
            reserveCapacity: jest.fn().mockResolvedValue(undefined),
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
        providerInvoiceId: '40506',
        url: 'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
      });
      const paymentRow = {
        id: 'payment-123',
        bookingId: 'bkg-123',
        idempotencyKey: 'checkout:payment-123',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        status: 'PENDING',
        sessionUrl:
          'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
        transactionId: '40506',
        providerPaymentId: '40506',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date(),
      };
      jest
        .spyOn(prisma.payment, 'create')
        .mockResolvedValue(paymentRow as never);
      jest
        .spyOn(prisma.payment, 'findUniqueOrThrow')
        .mockResolvedValue(paymentRow as never);

      const result = await service.initiatePayment('bkg-123', 'usr-123');

      expect(result.url).toContain('pay.getpayin.com');
      expect(gatewayMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'bkg-123',
          referenceCode: 'REF-123',
          amount: '100.00',
          currency: 'USD',
        }),
      );
      expect(
        (prisma.payment.create as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(0);
    });

    it('rejects legacy guest-token payment initiation', async () => {
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
      await expect(
        service.initiatePayment('bkg-guest', undefined),
      ).rejects.toThrow(NotFoundException);
      expect(gatewayMock.createSession).not.toHaveBeenCalled();
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

    it('reuses the database winner idempotency key when initiation races', async () => {
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

      const winningPayment = {
        id: 'payment-winning',
        bookingId: 'bkg-race',
        idempotencyKey: 'checkout:payment-winning',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        status: 'PENDING',
        sessionUrl:
          'https://pay.getpayin.com/integration/checkout?invoice_id=40507',
        transactionId: '40507',
        providerPaymentId: '40507',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        createdAt: new Date(),
      };
      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winningPayment as never);

      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        providerInvoiceId: '40507',
        url: 'https://pay.getpayin.com/integration/checkout?invoice_id=40507',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
      });

      const p2002Err = new Error('Unique constraint failed') as {
        code?: string;
      };
      p2002Err.code = 'P2002';
      jest.spyOn(prisma.payment, 'create').mockRejectedValue(p2002Err);
      jest
        .spyOn(prisma.payment, 'findUniqueOrThrow')
        .mockResolvedValue(winningPayment as never);

      const result = await service.initiatePayment('bkg-race', 'usr-123');

      expect(gatewayMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'bkg-race' }),
      );
      expect(result.providerInvoiceId).toBe('40507');
    });

    it('BUG-1: uses fresh paymentId as idempotency key when a stale session is expired', async () => {
      const staleCreatedAt = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago — past TTL
      const stalePayment = {
        id: 'stale-payment-id',
        bookingId: 'bkg-stale',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        transactionId: '99999',
        sessionUrl:
          'https://pay.getpayin.com/integration/checkout?invoice_id=99999',
        status: 'PENDING',
        isRefund: false,
        createdAt: staleCreatedAt,
      };
      const mockBooking = {
        id: 'bkg-stale',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        referenceCode: 'REF-STALE',
        userId: 'usr-123',
        guestTokenHash: null,
        tour: { currency: 'USD' },
        invoice: {
          currency: 'USD',
          total: new Prisma.Decimal(100),
          status: 'DRAFT',
        },
        billingInfo: {
          fullName: 'Stale Customer',
          email: 'stale@example.com',
          phone: '+201',
        },
        payments: [],
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockBooking as never);
      // First findFirst returns the stale payment (triggers expiry path)
      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValue(stalePayment as never);
      jest
        .spyOn(prisma.payment, 'update')
        .mockResolvedValue({ ...stalePayment, status: 'EXPIRED' } as never);
      jest.spyOn(gatewayMock, 'expireSession').mockResolvedValue(undefined);

      const newPaymentRow = {
        id: 'new-payment-id',
        bookingId: 'bkg-stale',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        status: 'PENDING',
        sessionUrl:
          'https://pay.getpayin.com/integration/checkout?invoice_id=88888',
        transactionId: '88888',
        providerPaymentId: '88888',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
      };
      jest
        .spyOn(prisma.payment, 'create')
        .mockResolvedValue(newPaymentRow as never);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        providerInvoiceId: '88888',
        url: 'https://pay.getpayin.com/integration/checkout?invoice_id=88888',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      await service.initiatePayment('bkg-stale', 'usr-123');

      // The idempotency key passed to the gateway MUST use the new paymentId,
      // NOT stale-payment-id (BUG 1 regression guard).
      const createSessionCall = (gatewayMock.createSession as jest.Mock).mock
        .calls[0][0];
      expect(createSessionCall.idempotencyKey).not.toContain(
        'stale-payment-id',
      );
      expect(createSessionCall.idempotencyKey).toMatch(
        /^checkout:[0-9a-f-]{36}$/,
      );
    });

    it('BUG-2: PAYMENT_EVENTS.INITIATED carries the internal DB UUID not the GetPayIn invoice ID', async () => {
      const mockBooking = {
        id: 'bkg-event',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal(100),
        referenceCode: 'REF-EVENT',
        userId: 'usr-event',
        guestTokenHash: null,
        tour: { currency: 'USD' },
        invoice: {
          currency: 'USD',
          total: new Prisma.Decimal(100),
          status: 'DRAFT',
        },
        billingInfo: {
          fullName: 'Event Customer',
          email: 'event@example.com',
          phone: '+201',
        },
        payments: [],
      };

      jest
        .spyOn(prisma.booking, 'findUnique')
        .mockResolvedValue(mockBooking as never);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        providerInvoiceId: '40506',
        url: 'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const dbPaymentId = 'db-uuid-not-40506';
      jest.spyOn(prisma.payment, 'create').mockResolvedValue({
        id: dbPaymentId,
        bookingId: 'bkg-event',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        status: 'PENDING',
        sessionUrl:
          'https://pay.getpayin.com/integration/checkout?invoice_id=40506',
        transactionId: '40506',
        providerPaymentId: '40506',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
      } as never);

      const eventEmitter = module.get<EventEmitter2>(EventEmitter2);
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.initiatePayment('bkg-event', 'usr-event');

      const initiatedCall = emitSpy.mock.calls.find(
        ([evt]) => evt === 'payment.initiated',
      );
      expect(initiatedCall).toBeDefined();
      // Must be the DB UUID, never the GetPayIn numeric invoice ID string
      expect(initiatedCall![1].paymentId).toBe(dbPaymentId);
      expect(initiatedCall![1].paymentId).not.toBe('40506');
    });
  });

  describe('handleWebhook', () => {
    it('rejects a webhook route that does not match the active provider', async () => {
      const reqMock = { headers: {} } as unknown as import('express').Request;

      await expect(
        service.handleWebhook(
          'UNSUPPORTED_PROVIDER',
          reqMock,
          Buffer.from('{}'),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(gatewayMock.verifyAndParseWebhook).not.toHaveBeenCalled();
    });

    it('marks a matching open payment as failed and keeps the booking retryable', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'evt-failed-1',
        event: 'invoice.not_paid',
        providerInvoiceId: '40506',
        providerStatus: 'UNPAID',
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
        provider: 'GETPAYIN',
        providerPaymentId: '40506',
        transactionId: '40506',
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

    it('atomically captures a matching invoice.paid event once', async () => {
      const pendingPayment = {
        id: 'payment-paid-1',
        bookingId: 'bkg-paid-1',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        provider: 'GETPAYIN',
        providerPaymentId: '40506',
        transactionId: '40506',
        status: 'PENDING',
        isRefund: false,
        createdAt: new Date(),
      };
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'paylink:paid-fixture',
        event: 'invoice.paid',
        providerInvoiceId: '40506',
        providerStatus: 'PAID',
        status: 'COMPLETED',
        rawEvent: {},
      });
      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue(null);
      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValue(pendingPayment as never);
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        id: 'bkg-paid-1',
        totalAmountUsd: new Prisma.Decimal(100),
        invoice: { id: 'invoice-1' },
      } as never);
      jest.spyOn(prisma.payment, 'update').mockResolvedValue({
        ...pendingPayment,
        status: 'CAPTURED',
      } as never);
      jest
        .spyOn(prisma.payment, 'findMany')
        .mockResolvedValue([{ amount: new Prisma.Decimal(100) }] as never);

      await expect(
        service.handleWebhook(
          'GETPAYIN',
          { headers: {} } as unknown as import('express').Request,
          Buffer.from('{}'),
        ),
      ).resolves.toEqual({ received: true });
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payment-paid-1' },
          data: expect.objectContaining({
            status: 'CAPTURED',
            providerStatus: 'PAID',
          }),
        }),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        }),
      );
    });

    it('rejects a validly signed event for an unknown PayLink invoice', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'evt-unknown',
        event: 'invoice.paid',
        providerInvoiceId: '999999',
        providerStatus: 'PAID',
        status: 'COMPLETED',
        rawEvent: {},
      });

      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue(null);

      const reqMock = { headers: {} } as unknown as import('express').Request;
      await expect(
        service.handleWebhook('GETPAYIN', reqMock, Buffer.from('')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should gracefully handle duplicate eventId without re-processing', async () => {
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'dup-123',
        event: 'invoice.paid',
        providerInvoiceId: '40506',
        providerStatus: 'PAID',
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

  describe('PayLink callback reconciliation', () => {
    it('recovers a missed paid webhook from server-side checkStatus', async () => {
      const pendingPayment = {
        id: 'payment-reconcile-1',
        bookingId: 'bkg-reconcile-1',
        amount: new Prisma.Decimal(100),
        currency: 'USD',
        method: 'GETPAYIN',
        provider: 'GETPAYIN',
        providerPaymentId: '40506',
        transactionId: '40506',
        status: 'PENDING',
        isRefund: false,
        createdAt: new Date(),
      };
      jest.spyOn(gatewayMock, 'verifyCallback').mockReturnValue('40506');
      jest.spyOn(gatewayMock, 'checkStatus').mockResolvedValue({
        providerInvoiceId: '40506',
        providerStatus: 'PAID',
        authCode: '831000',
      });
      jest
        .spyOn(prisma.payment, 'findFirst')
        .mockResolvedValueOnce({
          id: pendingPayment.id,
          booking: { userId: 'usr-123' },
        } as never)
        .mockResolvedValueOnce(pendingPayment as never)
        .mockResolvedValueOnce(pendingPayment as never);
      jest
        .spyOn(prisma.payment, 'findUniqueOrThrow')
        .mockResolvedValue(pendingPayment as never);
      jest
        .spyOn(prisma.processedWebhookEvent, 'findUnique')
        .mockResolvedValue(null);
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        id: pendingPayment.bookingId,
        totalAmountUsd: new Prisma.Decimal(100),
        invoice: { id: 'invoice-reconcile-1' },
      } as never);
      jest.spyOn(prisma.payment, 'update').mockResolvedValue({
        ...pendingPayment,
        status: 'CAPTURED',
      } as never);
      jest
        .spyOn(prisma.payment, 'findMany')
        .mockResolvedValue([{ amount: new Prisma.Decimal(100) }] as never);
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
        ...pendingPayment,
        status: 'CAPTURED',
        updatedAt: new Date(),
        booking: {
          id: pendingPayment.bookingId,
          userId: 'usr-123',
          referenceCode: 'DUNAS-1',
          status: 'CONFIRMED',
          guestTokenHash: null,
          invoice: { invoiceNumber: 'INV-1' },
        },
      } as never);

      await expect(
        service.reconcilePayLinkCallback(
          {
            success: 1,
            invoice_id: 40506,
            invoice_status: 'PAID',
            message: 'Invoice Paid',
            signature: 'verified-by-adapter',
          },
          'usr-123',
        ),
      ).resolves.toMatchObject({
        paymentId: pendingPayment.id,
        status: 'CAPTURED',
      });
      expect(gatewayMock.checkStatus).toHaveBeenCalledWith('40506');
      expect(gatewayMock.verifyCallback).toHaveBeenCalledWith(
        expect.objectContaining({ invoice_id: 40506 }),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED' }),
        }),
      );
    });
  });

  describe('refundPayment', () => {
    it('strictly rejects online refund attempts with BadRequestException as refunds are handled offline', async () => {
      await expect(
        service.refundPayment(
          'payment-123',
          50,
          'partial refund test',
          'refund-partial-1',
          { id: 'super-admin-1', role: 'SUPER_ADMIN' },
        ),
      ).rejects.toThrow('Online refunds via payment gateway are disabled');
    });

    it('ensures gateway refund is never invoked when refundPayment is called', async () => {
      try {
        await service.refundPayment(
          'payment-123',
          100,
          'attempt refund',
          'refund-full-1',
          { id: 'super-admin-1', role: 'SUPER_ADMIN' },
        );
      } catch {
        // Expected to throw BadRequestException
      }
      expect(gatewayMock.refund).not.toHaveBeenCalled();
    });
  });
});
