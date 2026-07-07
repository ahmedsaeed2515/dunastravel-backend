import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const IGNORE_TRANSFORM_KEY = 'ignoreTransform';

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, any>
{
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ignore = this.reflector.getAllAndOverride<boolean>(
      IGNORE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (ignore) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // If data is already paginated (has data and meta), return as is or wrap cleanly
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }

        // Standard wrap
        return {
          data: data !== undefined ? data : null,
          meta: {
            timestamp: new Date().toISOString(),
          }
        };
      }),
    );
  }
}
