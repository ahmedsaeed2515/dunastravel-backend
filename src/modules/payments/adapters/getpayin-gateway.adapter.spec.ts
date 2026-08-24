import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { GetPayInGatewayAdapter } from './getpayin-gateway.adapter';

describe('GetPayInGatewayAdapter', () => {
  it('reports missing merchant onboarding configuration without exposing values', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const adapter = new GetPayInGatewayAdapter(
      config as unknown as ConfigService,
    );

    expect(adapter.getReadiness()).toEqual(
      expect.objectContaining({
        provider: 'GETPAYIN',
        enabled: false,
        configured: false,
        mode: 'sandbox',
        supportedCurrencies: ['USD', 'EUR', 'EGP'],
      }),
    );
    expect(adapter.getReadiness().missingConfiguration).toContain(
      'GETPAYIN_API_KEY',
    );
  });

  it('fails closed even when environment values exist until the official contract is installed', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'GETPAYIN_MODE' ? 'sandbox' : 'configured-value',
      ),
    };
    const adapter = new GetPayInGatewayAdapter(
      config as unknown as ConfigService,
    );

    expect(adapter.getReadiness().missingConfiguration).toEqual([
      'GETPAYIN_OFFICIAL_API_CONTRACT',
    ]);
    await expect(adapter.createSession({} as never)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
