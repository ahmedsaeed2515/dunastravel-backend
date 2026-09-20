import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response, Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly etagCache = new Map<string, { etag: string; expiresAt: number }>();
  private readonly publicRoutes = [
    '/api/tours',
    '/api/destinations',
    '/api/blogs',
    '/api/faq',
    '/api/currency/rates',
    '/api/settings',
    '/api/journey-maps',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const method = req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      return next.handle();
    }

    const path = req.path || req.url;

    // Check if the route is private or authenticated
    const hasAuth = Boolean(
      req.headers.authorization ||
        req.headers.cookie?.includes('token') ||
        req.headers.cookie?.includes('session'),
    );

    const isExplicitlyPrivate =
      path.startsWith('/api/admin') ||
      path.startsWith('/api/auth') ||
      path.startsWith('/api/bookings') ||
      path.startsWith('/api/wishlist') ||
      path.startsWith('/api/in-app-notifications') ||
      path.startsWith('/api/wallets') ||
      path.startsWith('/api/invoices') ||
      hasAuth;

    if (isExplicitlyPrivate) {
      res.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Vary', 'Origin, Authorization, Accept-Encoding');
      return next.handle();
    }

    const isPublicCacheable = this.publicRoutes.some((route) =>
      path.startsWith(route),
    );

    if (!isPublicCacheable) {
      return next.handle();
    }

    // Public Cache Headers for Browser & CDN Edge
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    res.setHeader('Vary', 'Origin, Accept-Encoding');

    return next.handle().pipe(
      map((data) => {
        if (!data) return data;

        try {
          const cacheKey = req.originalUrl || req.url || path;
          const cached = this.etagCache.get(cacheKey);
          let etag: string;

          if (cached && cached.expiresAt > Date.now()) {
            etag = cached.etag;
          } else {
            const bodyStr = JSON.stringify(data);
            etag = `W/"${crypto
              .createHash('md5')
              .update(bodyStr)
              .digest('hex')}"`;

            if (this.etagCache.size > 2000) {
              const oldestKey = this.etagCache.keys().next().value;
              if (oldestKey) this.etagCache.delete(oldestKey);
            }
            this.etagCache.set(cacheKey, {
              etag,
              expiresAt: Date.now() + 60_000,
            });
          }

          res.setHeader('ETag', etag);

          const clientEtag = req.headers['if-none-match'];
          if (clientEtag && clientEtag === etag) {
            res.status(304).end();
            return null;
          }
        } catch {
          // If hashing fails, proceed with standard response
        }

        return data;
      }),
    );
  }
}
