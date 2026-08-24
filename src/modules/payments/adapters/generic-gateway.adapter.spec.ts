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
    const result = await adapter.createSession({
      paymentId: '00000000-0000-4000-8000-000000000001',
      bookingId: 'booking-123',
      amount: 150,
      currency: 'USD',
      referenceCode: 'BK-REF-1',
      successUrl: 'https://www.dunastravel.com/booking/success?payment_id=1',
      cancelUrl: 'https://www.dunastravel.com/booking/cancel?payment_id=1',
      webhookUrl: 'https://api.example.test/api/payments/webhook/generic_gateway',
      customer: {
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: '+201000000000',
      },
      idempotencyKey: 'checkout:test',
    });
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('transactionId');
    expect(result.url).toContain('/booking/success');
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
