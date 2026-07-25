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
  timestamp: string;
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
        // Avoid double-enveloping if the response is already paginated or wrapped
        if (resData && typeof resData === 'object' && 'data' in resData) {
          const { data, ...meta } = resData as Record<string, unknown>;
          return {
            success: true,
            statusCode: response.statusCode,
            data: data as T,
            ...meta,
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
