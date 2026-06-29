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
  data: T;
  message: string;
  statusCode: number;
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return next.handle() as any;
    }

    return next.handle().pipe(
      map((data: T) => ({
        data,
        message: 'Success',
        statusCode: response.statusCode,
      })),
    );
  }
}
