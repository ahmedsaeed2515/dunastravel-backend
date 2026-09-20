import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(`Database operation failed with code ${exception.code}: ${exception.message}`, exception.stack);

    const errorMap: Record<string, { status: number; message: string; code: string }> = {
      P2000: {
        status: HttpStatus.BAD_REQUEST,
        message: 'The provided value is too long for the column.',
        code: 'VALUE_TOO_LONG',
      },
      P2001: {
        status: HttpStatus.NOT_FOUND,
        message: 'Record not found.',
        code: 'NOT_FOUND',
      },
      P2002: {
        status: HttpStatus.CONFLICT,
        message: 'A record with this value already exists.',
        code: 'CONFLICT',
      },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found.', code: 'NOT_FOUND' },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Related record not found.',
        code: 'RELATION_INVALID',
      },
      P2011: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Null constraint violation on field.',
        code: 'NULL_CONSTRAINT_VIOLATION',
      },
      P2014: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid relationship data.',
        code: 'RELATION_INVALID',
      },
      P2015: {
        status: HttpStatus.NOT_FOUND,
        message: 'A related record could not be found.',
        code: 'RELATED_RECORD_NOT_FOUND',
      },
      P2024: {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database connection pool timeout. Please retry.',
        code: 'POOL_TIMEOUT',
      },
      P2028: {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database transaction timed out. Please retry.',
        code: 'TRANSACTION_FAILED',
      },
    };

    const isDev = process.env.NODE_ENV !== 'production';
    const mapped = errorMap[exception.code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isDev ? `Database error (${exception.code}): ${exception.message}` : 'An unexpected database error occurred.',
      code: exception.code || 'INTERNAL_SERVER_ERROR',
    };

    if (mapped.status >= 500) {
      Sentry.captureException(exception);
    }

    response.status(mapped.status).json({
      success: false,
      statusCode: mapped.status,
      code: mapped.code,
      message: mapped.message,
      error: mapped.message,
      timestamp: new Date().toISOString(),
    });
  }
}
