import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const statusCode = res.statusCode;
        const durationMs = Date.now() - startTime;
        this.logger.log({
          message: `${method} ${originalUrl} ${statusCode} - ${durationMs}ms`,
          method,
          path: originalUrl,
          statusCode,
          durationMs,
        });
      }),
      catchError((err) => {
        const durationMs = Date.now() - startTime;
        const statusCode = err.status || err.statusCode || 500;
        this.logger.error({
          message: `${method} ${originalUrl} ${statusCode} - ${durationMs}ms`,
          method,
          path: originalUrl,
          statusCode,
          durationMs,
        });
        throw err;
      }),
    );
  }
}
