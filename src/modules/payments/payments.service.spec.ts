import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { PAYMENT_EVENTS } from '../../common/events/payment-events';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
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
              update: jest.fn(),
            },
            processedWebhookEvent: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            payment: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: IPaymentGatewayPort,
          useValue: {
            createSession: jest.fn(),
            verifyAndParseWebhook: jest.fn(),
            refund: jest.fn(),
            getProviderName: jest.fn(),
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
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    gatewayMock = module.get<IPaymentGatewayPort>(IPaymentGatewayPort);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleWebhook', () => {
    it('should gracefully return and ignore duplicate eventId to prevent replay attacks', async () => {
      // Mock the gateway to parse the webhook and return an eventId
      jest.spyOn(gatewayMock, 'verifyAndParseWebhook').mockResolvedValue({
        eventId: 'duplicate-event-id',
        paymentId: 'payment-123',
        bookingId: 'bkg-123',
        amountUsd: 100,
        status: 'COMPLETED',
        rawEvent: {},
      });

      // Mock that this eventId has already been processed
      jest.spyOn(prisma.processedWebhookEvent, 'findUnique').mockResolvedValue({ id: 'duplicate-event-id' } as any);

      const result = await service.handleWebhook({ headers: {} }, Buffer.from(''));
      expect(result).toEqual({ received: true });
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  describe('initiatePayment', () => {
    it('should return session URL and update booking status', async () => {
      jest.spyOn(prisma.booking, 'findUnique').mockResolvedValue({
        id: 'bkg-123',
        status: 'PENDING',
        totalAmountUsd: { toNumber: () => 100 },
        currency: 'USD',
        userId: 'usr-123',
      } as any);

      jest.spyOn(gatewayMock, 'createSession').mockResolvedValue({
        transactionId: 'session-123',
        url: 'https://checkout.stripe.com/123',
      });

      const result = await service.initiatePayment('bkg-123', 'usr-123');

      expect(result.url).toBe('https://checkout.stripe.com/123');
      expect(prisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('should refund and emit event', async () => {
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue({
        id: 'payment-123',
        amount: { toNumber: () => 100 },
        currency: 'USD',
        method: 'STRIPE',
        transactionId: 'tx-123',
        status: 'CAPTURED',
        bookingId: 'bkg-123',
      } as any);

      jest.spyOn(gatewayMock, 'refund').mockResolvedValue({
        refundId: 'rf-123',
      });

      const result = await service.refundPayment('payment-123');

      expect(result.success).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(PAYMENT_EVENTS.REFUNDED, expect.any(Object));
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }),
      );
    });
  });
});
