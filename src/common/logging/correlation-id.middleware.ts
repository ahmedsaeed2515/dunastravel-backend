import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { AsyncContextService } from './async-context.service';

export const CORRELATION_ID_KEY = 'correlationId';
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly asyncContextService: AsyncContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const supplied = req.headers[CORRELATION_ID_HEADER.toLowerCase()];
    const correlationId =
      typeof supplied === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(supplied)
        ? supplied
        : crypto.randomUUID();

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    const store = new Map<string, string>();
    store.set(CORRELATION_ID_KEY, correlationId);

    this.asyncContextService.run(store, () => {
      next();
    });
  }
}
