import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const path = req.path || req.originalUrl || req.url || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const statusCode = res.statusCode;
        const durationMs = Date.now() - startTime;

        if (durationMs > 500) {
          this.logger.warn({
            message: `⚠️ SLOW API REQUEST: ${method} ${path} ${statusCode} - ${durationMs}ms`,
            method,
            path,
            statusCode,
            durationMs,
          });
        } else {
          this.logger.log({
            message: `${method} ${path} ${statusCode} - ${durationMs}ms`,
            method,
            path,
            statusCode,
            durationMs,
          });
        }
      }),
      catchError((err) => {
        const durationMs = Date.now() - startTime;
        const statusCode = err.status || err.statusCode || 500;
        this.logger.error({
          message: `${method} ${path} ${statusCode} - ${durationMs}ms`,
          method,
          path,
          statusCode,
          durationMs,
        });
        throw err;
      }),
    );
  }
}
