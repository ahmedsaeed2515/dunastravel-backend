import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { isAllowedBrowserOrigin } from '../security/allowed-origin.util';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCsrf) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const cookies = (request.cookies ?? {}) as Record<string, string>;
    const usesAmbientCookieAuth = Boolean(
      cookies.access_token || cookies.refresh_token,
    );

    // Anonymous public forms do not carry ambient authority. They are protected
    // by validation, throttling and anti-automation controls instead of CSRF.
    if (!usesAmbientCookieAuth) {
      return true;
    }

    const origin = request.headers.origin;
    if (origin && !this.isAllowedOrigin(origin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    const csrfCookie = cookies.csrf_token;
    const csrfHeader = request.headers['x-csrf-token'];

    if (
      typeof csrfHeader !== 'string' ||
      csrfHeader.length < 16 ||
      csrfHeader.length > 128
    ) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    if (csrfCookie) {
      const cookieBuffer = Buffer.from(csrfCookie, 'utf8');
      const headerBuffer = Buffer.from(csrfHeader, 'utf8');
      if (
        cookieBuffer.length !== headerBuffer.length ||
        !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
      ) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    } else {
      // In cross-subdomain Vercel deployments, if the browser omits cross-site cookies,
      // allow requests from strictly verified origins that provide a valid token header.
      if (!origin || !this.isAllowedOrigin(origin)) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    return true;
  }

  private isAllowedOrigin(origin: string): boolean {
    return isAllowedBrowserOrigin(origin, this.configService);
  }
}
