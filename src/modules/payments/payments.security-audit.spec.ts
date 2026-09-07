import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CommissionsService } from '../commissions/commissions.service';
import { AvailabilityService } from '../availability/availability.service';
import { ConfigService } from '@nestjs/config';

describe('Payments Security & Anti-Fraud Suite', () => {
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
            $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
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
              aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
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
              enabled: true,
              configured: true,
              mode: 'sandbox',
              supportedCurrencies: ['USD', 'EUR', 'EGP'],
              missingConfiguration: [],
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: CommissionsService,
          useValue: {
            reverseCommissionForBooking: jest.fn().mockResolvedValue(undefined),
            adjustCommissionForPartialRefund: jest.fn().mockResolvedValue(undefined),
          },
        },
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
            get: jest.fn((k: string) => {
              if (k === 'GETPAYIN_REDIRECT_URL') return 'https://dunastravel.com/booking/success';
              if (k === 'GETPAYIN_WEBHOOK_URL') return 'https://dunastravel.com/api/payments/webhook/getpayin';
              return null;
            }),
            getOrThrow: jest.fn((k: string) => {
              if (k === 'GETPAYIN_REDIRECT_URL') return 'https://dunastravel.com/booking/success';
              if (k === 'GETPAYIN_WEBHOOK_URL') return 'https://dunastravel.com/api/payments/webhook/getpayin';
              throw new Error(`Missing ${k}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    gatewayMock = module.get<IPaymentGatewayPort>(IPaymentGatewayPort);
  });

  describe('IDOR / BOLA Protections', () => {
    it('should reject payment initiation for booking owned by another user', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        id: 'bkg-victim',
        userId: 'user-victim',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal('500.00'),
        payments: [],
      });

      await expect(service.initiatePayment('bkg-victim', 'user-attacker')).rejects.toThrow(NotFoundException);
    });

    it('should reject payment status retrieval for payment owned by another user', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-victim',
        amount: new Prisma.Decimal('500.00'),
        currency: 'USD',
        status: 'CAPTURED',
        booking: {
          id: 'bkg-victim',
          userId: 'user-victim',
          referenceCode: 'BKG-VICTIM',
          status: 'CONFIRMED',
          guestTokenHash: null,
          invoice: { invoiceNumber: 'INV-001' },
        },
      });

      await expect(service.getPaymentStatus('pay-victim', 'user-attacker')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Refund Role & Privilege Escalation Protections', () => {
    it('should reject refund when requested by non-super-admin user', async () => {
      await expect(
        service.refundPayment('pay-1', 100, 'Test', 'ref-1', { id: 'user-1', role: 'USER' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.refundPayment('pay-1', 100, 'Test', 'ref-1', { id: 'agent-1', role: 'AGENT' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.refundPayment('pay-1', 100, 'Test', 'ref-1', { id: 'admin-1', role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Webhook Replay & Idempotency Attacks', () => {
    it('should safely return 200 without side effects when receiving duplicate webhook event', async () => {
      (gatewayMock.verifyAndParseWebhook as jest.Mock).mockResolvedValue({
        eventId: 'paylink:event-hash-1',
        event: 'invoice.paid',
        providerInvoiceId: '40506',
        providerStatus: 'PAID',
        status: 'COMPLETED',
        rawEvent: { signature: 'sig' },
      });
      (prisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'paylink:event-hash-1',
      });

      const res = await service.handleWebhook('GETPAYIN', {} as any, Buffer.from('{}'));
      expect(res).toEqual({ received: true });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('Financial Snapshot & Pricing Integrity', () => {
    it('should reject payment initiation if invoice total does not match booking totalAmountUsd', async () => {
      (prisma.booking.findUnique as jest.Mock).mockResolvedValue({
        id: 'bkg-1',
        userId: 'user-1',
        status: 'PENDING',
        totalAmountUsd: new Prisma.Decimal('500.00'),
        tour: { currency: 'USD' },
        invoice: { currency: 'USD', total: new Prisma.Decimal('1.00') }, // tampered invoice total
        billingInfo: { fullName: 'Test', email: 'test@example.com', phone: '123456789' },
        payments: [],
      });

      await expect(service.initiatePayment('bkg-1', 'user-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
