import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IPaymentGatewayPort } from './interfaces/payment-gateway.port';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Money } from '../../common/domain/value-objects/money.vo';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let gateway: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      processedWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    gateway = {
      createSession: jest.fn(),
      verifyAndParseWebhook: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('MOCK_STRIPE'),
      refund: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: IPaymentGatewayPort, useValue: gateway },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('initiatePayment', () => {
    it('should initiate payment and return session', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: 'b-1', status: 'PENDING', totalAmountUsd: { toNumber: () => 100 } });
      gateway.createSession.mockResolvedValue({ url: 'http://pay', transactionId: 'txn-1' });

      const res = await service.initiatePayment('b-1');

      expect(res.url).toBe('http://pay');
      expect(prisma.payment.create).toHaveBeenCalled();
    });

    it('should throw if booking not PENDING', async () => {
      prisma.booking.findUnique.mockResolvedValue({ id: 'b-1', status: 'PAID', totalAmountUsd: { toNumber: () => 100 } });

      await expect(service.initiatePayment('b-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPayment', () => {
    it('should throw if payment not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.refundPayment('p-1')).rejects.toThrow(NotFoundException);
    });

    it('should refund captured payment', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'p-1',
        bookingId: 'b-1',
        amount: { toNumber: () => 100 },
        currency: 'USD',
        status: 'CAPTURED',
        transactionId: 'txn-1',
        createdAt: new Date(),
      });
      gateway.refund.mockResolvedValue({ refundId: 'ref-1' });

      const res = await service.refundPayment('p-1');
      expect(res.success).toBe(true);
      expect(prisma.payment.update).toHaveBeenCalled();
    });
  });
});
