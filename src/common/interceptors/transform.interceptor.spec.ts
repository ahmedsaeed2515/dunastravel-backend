import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import {
  ResponseTransformInterceptor,
  IGNORE_TRANSFORM_KEY,
} from './response-transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap response in standard envelope', (done) => {
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
        getRequest: () => ({ url: '/api/tours' }),
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ title: 'Test Tour' }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({ title: 'Test Tour' });
      expect(result.timestamp).toBeDefined();
      done();
    });
  });

  it('should skip wrapping for health endpoint', (done) => {
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
        getRequest: () => ({ url: '/api/health' }),
      }),
    } as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ status: 'ok' });
      done();
    });
  });
});

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<any>;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new ResponseTransformInterceptor(reflector);
  });

  it('should wrap response with data and meta', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ title: 'Test Tour' }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result.data).toEqual({ title: 'Test Tour' });
      expect(result.meta.timestamp).toBeDefined();
      done();
    });
  });

  it('should bypass transformation if ignore flag is set', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ raw: true }),
    };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({ raw: true });
      done();
    });
  });
});
