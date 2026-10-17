import { LoggerService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncContextService } from './async-context.service';
import { CORRELATION_ID_KEY } from './correlation-id.middleware';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const SENSITIVE_LOG_KEY =
  /password|passcode|secret|token|authorization|cookie|passport|credit.?card|card.?number|cvv|raw.?body/i;

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

  private safeStringify(obj: unknown): string {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (SENSITIVE_LOG_KEY.test(key)) {
        return '[REDACTED]';
      }
      if (value instanceof Error) {
        return {
          message: this.sanitizeString(value.message),
          stack: this.nodeEnv === 'production' ? undefined : value.stack,
          name: value.name,
        };
      }
      if (typeof value === 'string') {
        return this.sanitizeString(value);
      }
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    });
  }

  private sanitizeString(value: string): string {
    return value
      .slice(0, 4_000)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  }

  private print(
    level: LogLevel,
    message: unknown,
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

    if (this.nodeEnv === 'production' && 'stack' in logObject) {
      delete logObject.stack;
    }

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
