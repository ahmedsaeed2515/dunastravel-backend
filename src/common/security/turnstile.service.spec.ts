import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'nodeEnv') return 'test';
        if (key === 'turnstile.secretKey') return '0x4AAAAAAtestsecret';
        if (key === 'turnstile.skip') return false;
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TurnstileService>(TurnstileService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should bypass verification if turnstile.skip is true', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'turnstile.skip') return true;
      return undefined;
    });

    const result = await service.validateToken(undefined);
    expect(result.success).toBe(true);
  });

  it('should bypass verification if secret key is missing in non-production', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'development';
      if (key === 'turnstile.secretKey') return undefined;
      return undefined;
    });

    const result = await service.validateToken(undefined);
    expect(result.success).toBe(true);
  });

  it('should bypass verification if secret key is missing in production and enforce is not enabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'production';
      if (key === 'turnstile.secretKey') return undefined;
      if (key === 'turnstile.enforce') return false;
      return undefined;
    });

    const result = await service.validateToken(undefined);
    expect(result.success).toBe(true);
  });

  it('should throw InternalServerErrorException if secret key is missing in production when enforce is true', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'nodeEnv') return 'production';
      if (key === 'turnstile.secretKey') return undefined;
      if (key === 'turnstile.enforce') return true;
      return undefined;
    });

    await expect(service.validateToken('dummy-token')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw BadRequestException if token is missing or empty', async () => {
    await expect(service.validateToken('')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.validateToken('   ')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.validateToken(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should pass with Cloudflare standard dummy pass token in non-production', async () => {
    const result = await service.validateToken(
      '1x0000000000000000000000000000000AA',
      '127.0.0.1',
      'register',
    );
    expect(result.success).toBe(true);
    expect(result.action).toBe('register');
  });

  it('should reject Cloudflare standard dummy fail token in non-production', async () => {
    await expect(
      service.validateToken('2x0000000000000000000000000000000AA', '127.0.0.1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should call Cloudflare siteverify endpoint and return success on valid token', async () => {
    const mockResponse = {
      success: true,
      challenge_ts: '2026-09-08T00:00:00Z',
      hostname: 'www.dunastravel.com',
      action: 'register',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    const result = await service.validateToken(
      'cf-token-real',
      '1.2.3.4',
      'register',
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: '0x4AAAAAAtestsecret',
          response: 'cf-token-real',
          remoteip: '1.2.3.4',
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.hostname).toBe('www.dunastravel.com');
  });

  it('should throw BadRequestException if action does not match expectedAction', async () => {
    const mockResponse = {
      success: true,
      hostname: 'www.dunastravel.com',
      action: 'login',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    await expect(
      service.validateToken('cf-token-real', '1.2.3.4', 'register'),
    ).rejects.toThrow(
      'Security challenge validation mismatch for the requested action.',
    );
  });

  it('should throw BadRequestException if Cloudflare returns success: false', async () => {
    const mockResponse = {
      success: false,
      'error-codes': ['invalid-input-response'],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    } as any);

    await expect(
      service.validateToken('invalid-token', '1.2.3.4'),
    ).rejects.toThrow(BadRequestException);
  });
});
