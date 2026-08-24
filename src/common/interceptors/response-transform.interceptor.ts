import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Response as ExpressResponse } from 'express';
import { isCanonicalPaginatedPayload } from './transform.interceptor';

export const IGNORE_TRANSFORM_KEY = 'ignoreTransform';

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  { success: true; statusCode: number; data: T; meta?: Record<string, unknown>; timestamp: string }
> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<{ success: true; statusCode: number; data: T; meta?: Record<string, unknown>; timestamp: string }> {
    const ignore = this.reflector.getAllAndOverride<boolean>(
      IGNORE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (ignore) {
      return next.handle() as Observable<{ success: true; statusCode: number; data: T; meta?: Record<string, unknown>; timestamp: string }>;
    }

    const response = context.switchToHttp().getResponse<ExpressResponse>();
    return next.handle().pipe(map((data: unknown) => {
      const paginated = isCanonicalPaginatedPayload(data);
      return {
        success: true,
        statusCode: response.statusCode,
        data: (paginated ? data.data : data) as T,
        ...(paginated ? { meta: data.meta } : {}),
        timestamp: new Date().toISOString(),
      };
    }));
  }
}
