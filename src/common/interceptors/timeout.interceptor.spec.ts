import { TimeoutInterceptor } from './timeout.interceptor';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError, TimeoutError, delay } from 'rxjs';
import { lastValueFrom } from 'rxjs';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;
  let configService: jest.Mocked<ConfigService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(100), // 100ms timeout
    } as any;

    mockExecutionContext = {} as any;

    interceptor = new TimeoutInterceptor(configService);
  });

  it('should pass through normal responses', async () => {
    const callHandler: CallHandler = {
      handle: () => of('success'),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockExecutionContext, callHandler),
    );
    expect(result).toBe('success');
  });

  it('should throw 408 on timeout', async () => {
    // A stream that completes after 200ms
    const callHandler: CallHandler = {
      handle: () => of('delayed').pipe(delay(200)),
    };

    await expect(
      lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
    ).rejects.toMatchObject({
      statusCode: 408,
      message: 'Request Timeout',
    });
  });

  it('should pass through other errors', async () => {
    const error = new Error('Other error');
    const callHandler: CallHandler = {
      handle: () => throwError(() => error),
    };

    await expect(
      lastValueFrom(interceptor.intercept(mockExecutionContext, callHandler)),
    ).rejects.toThrow('Other error');
  });
});
