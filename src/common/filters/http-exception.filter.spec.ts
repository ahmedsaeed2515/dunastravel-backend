import { BadRequestException, ArgumentsHost, UnprocessableEntityException } from '@nestjs/common';
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

    new HttpExceptionFilter().catch(new BadRequestException(['email must be an email']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: ['email must be an email'],
      path: '/api/bookings',
    }));
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

    new HttpExceptionFilter().catch(new UnprocessableEntityException(['arrivalDate must not be in the past']), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      statusCode: 422,
      code: 'VALIDATION_FAILED',
    }));
  });
});
