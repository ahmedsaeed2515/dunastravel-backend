import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GenericPaymentGatewayAdapter } from './generic-gateway.adapter';
import { Request } from 'express';

describe('GenericPaymentGatewayAdapter', () => {
  let adapter: GenericPaymentGatewayAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenericPaymentGatewayAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://www.dunastravel.com'),
          },
        },
      ],
    }).compile();

    adapter = module.get<GenericPaymentGatewayAdapter>(
      GenericPaymentGatewayAdapter,
    );
  });

  it('should return provider name', () => {
    expect(adapter.getProviderName()).toBe('GENERIC_GATEWAY');
  });

  it('should create session and return checkout URL', async () => {
    const result = await adapter.createSession('booking-123', 150, 'USD', 'BK-REF-1');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('transactionId');
    expect(result.url).toContain('bookingId=booking-123');
  });

  it('should verify and parse webhook payload', async () => {
    const mockReq = {
      body: {
        eventId: 'evt_123',
        paymentId: 'pay_456',
        bookingId: 'booking-123',
        amountUsd: 150,
        status: 'COMPLETED',
      },
    } as unknown as Request;

    const payload = await adapter.verifyAndParseWebhook(
      mockReq,
      Buffer.from(''),
    );
    expect(payload.eventId).toBe('evt_123');
    expect(payload.status).toBe('COMPLETED');
  });

  it('should handle refund request', async () => {
    const result = await adapter.refund('txn_123', 100);
    expect(result).toHaveProperty('refundId');
  });
});
