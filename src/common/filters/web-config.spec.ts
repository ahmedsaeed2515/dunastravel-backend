import fs from 'node:fs';
import path from 'node:path';
import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  ArgumentsHost,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('IIS/Plesk web.config and Error JSON Enforcement', () => {
  it('contains web.config with httpErrors existingResponse="PassThrough"', () => {
    const configPath = path.resolve(__dirname, '../../../web.config');
    expect(fs.existsSync(configPath)).toBe(true);

    const xml = fs.readFileSync(configPath, 'utf8');
    expect(xml).toContain('<httpErrors existingResponse="PassThrough" />');
    expect(xml).toContain('<add segment=".env" />');
  });

  it('guarantees structured JSON envelope across all error statuses (400, 401, 403, 404, 409, 422, 429, 500, 503)', () => {
    const cases = [
      { ex: new BadRequestException('Invalid input'), status: 400 },
      { ex: new UnauthorizedException('Authentication required'), status: 401 },
      { ex: new ForbiddenException('Forbidden access'), status: 403 },
      { ex: new NotFoundException('Resource not found'), status: 404 },
      { ex: new ConflictException('State conflict'), status: 409 },
      {
        ex: new UnprocessableEntityException('Unprocessable entity'),
        status: 422,
      },
      { ex: new HttpException('Too Many Requests', 429), status: 429 },
      { ex: new InternalServerErrorException('Server failure'), status: 500 },
      {
        ex: new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_UNAVAILABLE',
          message: 'Payment provider is temporarily unavailable',
        }),
        status: 503,
      },
    ];

    const filter = new HttpExceptionFilter();

    for (const { ex, status } of cases) {
      const json = jest.fn();
      const statusFn = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status: statusFn }),
          getRequest: () => ({ path: '/api/test' }),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(ex, host);

      expect(statusFn).toHaveBeenCalledWith(status);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: status,
          code: expect.any(String),
          message: expect.anything(),
          error: expect.any(String),
          timestamp: expect.any(String),
          path: '/api/test',
        }),
      );
    }
  });
});
