import {
  BadRequestException,
  ArgumentsHost,
  UnprocessableEntityException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter canonical error envelope', () => {
  it('marks validation errors with a machine-readable code and preserves the path', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ path: '/api/bookings' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new BadRequestException(['email must be an email']),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: ['email must be an email'],
        path: '/api/bookings',
      }),
    );
  });

  it('uses the same validation code for 422 while retaining its distinct HTTP status', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ path: '/api/bookings' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new UnprocessableEntityException(['arrivalDate must not be in the past']),
      host,
    );

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 422,
        code: 'VALIDATION_FAILED',
      }),
    );
  });

  it('preserves code PAYMENT_PROVIDER_UNAVAILABLE and client-safe message for 503', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ path: '/api/payments/initiate' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Payment provider is temporarily unavailable',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 503,
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Payment provider is temporarily unavailable',
        error: 'Service Unavailable',
        path: '/api/payments/initiate',
      }),
    );
  });

  it('sanitizes unexpected 500 errors to prevent leaking internal stack traces or details', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ path: '/api/bookings' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new InternalServerErrorException(
        'Database disk full at /var/lib/postgresql',
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        code: 'HTTP_500',
        message: 'An unexpected server error occurred',
        error: 'Internal Server Error',
        path: '/api/bookings',
      }),
    );
  });
});
