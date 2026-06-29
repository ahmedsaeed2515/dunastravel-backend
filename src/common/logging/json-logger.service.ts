import { LoggerService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncContextService } from './async-context.service';
import { CORRELATION_ID_KEY } from './correlation-id.middleware';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly minLevel: number;
  private readonly nodeEnv: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly asyncContextService: AsyncContextService,
  ) {
    const configuredLevel =
      this.configService.get<string>('LOG_LEVEL') || 'info';
    this.minLevel = LOG_LEVELS[configuredLevel as LogLevel] ?? LOG_LEVELS.info;
    this.nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
  }

  private safeStringify(obj: any): string {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    });
  }

  private print(
    level: LogLevel,
    message: any,
    context?: string,
    meta?: Record<string, any>,
  ): void {
    if (LOG_LEVELS[level] < this.minLevel) {
      return;
    }

    const correlationId =
      this.asyncContextService.get(CORRELATION_ID_KEY) || null;

    // Safely extract string message
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);

    const logObject: any = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: msg,
      correlationId,
      pid: process.pid,
      nodeEnv: this.nodeEnv,
      ...meta,
    };

    // Use console.log for all levels to pipe to stdout properly in Docker
    console.log(this.safeStringify(logObject));
  }

  log(message: any, context?: string): void {
    this.print('info', message, context);
  }

  error(
    message: any,
    trace?: string,
    context?: string,
    meta?: Record<string, any>,
  ): void {
    this.print('error', message, context, { stack: trace, ...meta });
  }

  warn(message: any, context?: string): void {
    this.print('warn', message, context);
  }

  debug(message: any, context?: string): void {
    this.print('debug', message, context);
  }
}
