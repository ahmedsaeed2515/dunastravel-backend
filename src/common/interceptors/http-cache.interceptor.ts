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
    '/api/tour-landing-pages',
    '/api/blogs',
    '/api/faq',
    '/api/faqs',
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
      res.setHeader('X-Cache', 'PRIVATE-BYPASS');
      return next.handle();
    }

    const isPublicCacheable = this.publicRoutes.some((route) =>
      path.startsWith(route),
    );

    if (!isPublicCacheable) {
      return next.handle();
    }

    const cacheKey = req.originalUrl || req.url || path;
    const clientEtag = req.headers['if-none-match'];

    // FAST 304 SHORT-CIRCUIT: If we have an active ETag and client sends matching If-None-Match,
    // respond 304 immediately without executing route handlers, services, or database queries!
    const activeCached = this.etagCache.get(cacheKey);
    if (activeCached && activeCached.expiresAt > Date.now() && clientEtag && clientEtag === activeCached.etag) {
      res.setHeader('ETag', activeCached.etag);
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      res.setHeader('Vary', 'Origin, Accept-Encoding');
      res.setHeader('X-Cache', 'HIT-304');
      res.status(304).end();
      return of(null);
    }

    // Public Cache Headers for Browser & CDN Edge
    res.setHeader(
      'Cache-Control',
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    res.setHeader('Vary', 'Origin, Accept-Encoding');

    return next.handle().pipe(
      map((data) => {
        if (!data || res.headersSent) return data;

        try {
          let etag: string;
          const cached = this.etagCache.get(cacheKey);

          if (cached && cached.expiresAt > Date.now()) {
            etag = cached.etag;
            res.setHeader('X-Cache', 'HIT-WARM');
          } else {
            // Compute deterministic ETag over authoritative business payload (ignoring volatile outer timestamps)
            const contentToHash =
              data && typeof data === 'object' && 'data' in data
                ? { data: (data as any).data, meta: (data as any).meta }
                : data;
            const bodyStr = JSON.stringify(contentToHash);
            etag = `W/"${crypto
              .createHash('sha1')
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
            res.setHeader('X-Cache', 'MISS-POPULATED');
          }

          res.setHeader('ETag', etag);

          if (clientEtag && clientEtag === etag) {
            res.setHeader('X-Cache', 'HIT-304');
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
