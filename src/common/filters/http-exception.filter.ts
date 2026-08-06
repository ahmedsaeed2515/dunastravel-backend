import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (status >= 500) {
      Sentry.captureException(exception);
    }

    let message: string | string[] = exception.message;
    let error = exception.name;

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const resObj = exceptionResponse as Record<string, unknown>;
      if ('message' in resObj) {
        message = resObj.message as string | string[];
      }
      if ('error' in resObj) {
        error = resObj.error as string;
      }
    }

    if (status >= 500) {
      message = 'An unexpected server error occurred';
      error = 'Internal Server Error';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
