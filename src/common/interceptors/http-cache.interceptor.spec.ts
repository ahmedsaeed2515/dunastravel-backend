import { HttpCacheInterceptor } from './http-cache.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('HttpCacheInterceptor', () => {
  let interceptor: HttpCacheInterceptor;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let req: any;
  let res: any;

  beforeEach(() => {
    interceptor = new HttpCacheInterceptor();
    req = {
      method: 'GET',
      path: '/api/tours',
      url: '/api/tours',
      headers: {},
    };
    res = {
      headers: {},
      setHeader: jest.fn((key, value) => {
        res.headers[key] = value;
      }),
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
      headersSent: false,
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;

    mockCallHandler = {
      handle: jest
        .fn()
        .mockReturnValue(
          of({ success: true, data: [{ id: '1', title: 'Tour 1' }] }),
        ),
    };
  });

  it('sets public cache-control and ETag for public GET routes', (done) => {
    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'ETag',
        expect.stringMatching(/^W\/"[a-f0-9]+"/),
      );
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS-POPULATED');
      expect(result).toEqual({
        success: true,
        data: [{ id: '1', title: 'Tour 1' }],
      });
      done();
    });
  });

  it('bypasses caching for authenticated or private routes', (done) => {
    req.path = '/api/bookings/me';
    req.headers.authorization = 'Bearer token-123';

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate',
      );
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'PRIVATE-BYPASS');
      done();
    });
  });

  it('short-circuits with HTTP 304 when If-None-Match matches cached ETag', (done) => {
    // 1. Initial request to populate etagCache
    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      const generatedEtag = res.headers['ETag'];
      expect(generatedEtag).toBeDefined();

      // 2. Second request with matching If-None-Match
      const req2: any = {
        method: 'GET',
        path: '/api/tours',
        url: '/api/tours',
        headers: { 'if-none-match': generatedEtag },
      };
      const res2: any = {
        headers: {},
        setHeader: jest.fn((k, v) => {
          res2.headers[k] = v;
        }),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };
      const mockContext2 = {
        switchToHttp: () => ({
          getRequest: () => req2,
          getResponse: () => res2,
        }),
      } as any;
      const mockCallHandler2: CallHandler = {
        handle: jest.fn().mockReturnValue(of({})),
      };

      interceptor.intercept(mockContext2, mockCallHandler2).subscribe(() => {
        // Must short-circuit immediately with 304
        expect(res2.status).toHaveBeenCalledWith(304);
        expect(res2.end).toHaveBeenCalled();
        expect(res2.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT-304');
        // Must NOT call route handler/database!
        expect(mockCallHandler2.handle).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
