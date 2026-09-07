import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TurnstileGuard } from './turnstile.guard';
import { TurnstileService } from './turnstile.service';

describe('TurnstileGuard', () => {
  let guard: TurnstileGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let turnstileService: { validateToken: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    turnstileService = { validateToken: jest.fn() };
    guard = new TurnstileGuard(
      reflector as unknown as Reflector,
      turnstileService as unknown as TurnstileService,
    );
  });

  const createMockContext = (headers: Record<string, any> = {}, body: Record<string, any> = {}) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          body,
          ip: '127.0.0.1',
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should extract token from cf-turnstile-token header and validate', async () => {
    reflector.getAllAndOverride.mockReturnValue('register');
    turnstileService.validateToken.mockResolvedValue({ success: true });

    const context = createMockContext({ 'cf-turnstile-token': 'token-from-header' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(turnstileService.validateToken).toHaveBeenCalledWith(
      'token-from-header',
      '127.0.0.1',
      'register',
    );
  });

  it('should extract token from body turnstileToken if header is not present', async () => {
    reflector.getAllAndOverride.mockReturnValue('resend_verification');
    turnstileService.validateToken.mockResolvedValue({ success: true });

    const context = createMockContext({}, { turnstileToken: 'token-from-body' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(turnstileService.validateToken).toHaveBeenCalledWith(
      'token-from-body',
      '127.0.0.1',
      'resend_verification',
    );
  });

  it('should throw if turnstileService throws BadRequestException', async () => {
    reflector.getAllAndOverride.mockReturnValue('register');
    turnstileService.validateToken.mockRejectedValue(
      new BadRequestException('Challenge token required'),
    );

    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });
});
