import { Test, TestingModule } from '@nestjs/testing';
import { StripeAdapter } from './stripe.adapter';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('StripeAdapter', () => {
  let adapter: StripeAdapter;
  let configMock: any;

  beforeEach(async () => {
    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock_123';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeAdapter,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    adapter = module.get<StripeAdapter>(StripeAdapter);
  });

  it('should return correct provider name', () => {
    expect(adapter.getProviderName()).toBe('STRIPE');
  });

  it('should throw BadRequestException if stripe-signature header is missing', async () => {
    const req: any = { headers: {} };
    const rawBody = Buffer.from('{}');

    await expect(adapter.verifyAndParseWebhook(req, rawBody)).rejects.toThrow(
      BadRequestException,
    );
  });
});
