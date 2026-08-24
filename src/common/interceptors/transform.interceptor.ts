import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response as ExpressResponse } from 'express';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface PaginationMeta {
  [key: string]: unknown;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CanonicalPaginatedPayload<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Only a list paired with the complete canonical pagination metadata is
 * unwrapped into the outer success envelope. A business object that happens
 * to have `data` and `meta` properties remains an item response.
 */
export function isCanonicalPaginatedPayload(
  value: unknown,
): value is CanonicalPaginatedPayload<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.data) || !candidate.meta || typeof candidate.meta !== 'object') return false;
  const meta = candidate.meta as Record<string, unknown>;
  return ['total', 'page', 'limit', 'totalPages'].every(
    (key) => typeof meta[key] === 'number' && Number.isFinite(meta[key]),
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<ExpressResponse>();
    const request = ctx.getRequest<Request>();

    // Skip wrapping for health check endpoint to preserve Terminus response shape
    if (request.url.startsWith('/api/health')) {
      return next.handle() as Observable<Response<T>>;
    }

    return next.handle().pipe(
      map((resData: unknown) => {
        // Collections are represented only as { data: T[], meta: PaginationMeta }.
        // Do not treat a business object with a `data` property as an envelope.
        if (isCanonicalPaginatedPayload(resData)) {
          const { data, meta } = resData;
          return {
            success: true,
            statusCode: response.statusCode,
            data: data as T,
            meta,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          statusCode: response.statusCode,
          data: resData as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
