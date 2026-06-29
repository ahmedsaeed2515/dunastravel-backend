import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();

    // Silence logger in tests
    (interceptor as any).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;
  });

  it('should log on success', async () => {
    const callHandler: CallHandler = {
      handle: () => of('success'),
    };

    await lastValueFrom(
      interceptor.intercept(mockExecutionContext, callHandler),
    );

    expect((interceptor as any).logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
    );
  });

  it('should log on error', async () => {
    const callHandler: CallHandler = {
      handle: () => throwError(() => ({ statusCode: 400 })),
    };

    try {
      await lastValueFrom(
        interceptor.intercept(mockExecutionContext, callHandler),
      );
    } catch (e) {
      // Expected to throw
    }

    expect((interceptor as any).logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/test',
        statusCode: 400,
        durationMs: expect.any(Number),
      }),
    );
  });
});
