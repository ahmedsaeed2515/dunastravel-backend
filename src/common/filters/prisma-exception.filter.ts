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

    this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);

    const errorMap: Record<string, { status: number; message: string }> = {
      P2002: {
        status: HttpStatus.CONFLICT,
        message: 'A record with this value already exists.',
      },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found.' },
      P2003: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Related record not found.',
      },
      P2014: {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid relationship data.',
      },
    };

    const mapped = errorMap[exception.code] ?? {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected database error occurred.',
    };

    if (mapped.status >= 500) {
      Sentry.captureException(exception);
    }

    response.status(mapped.status).json({
      success: false,
      statusCode: mapped.status,
      error: mapped.message,
      timestamp: new Date().toISOString(),
    });
  }
}
