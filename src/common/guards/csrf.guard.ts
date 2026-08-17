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
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'https://www.dunastravel.com',
      'https://dunastravel.com',
      'https://admin.dunastravel.com',
      'https://dunastravel-dashbord.vercel.app',
      'https://dunastravel-dashboard.vercel.app',
      'https://dunastravel-tours.vercel.app',
      'https://dunastravel-frontend.vercel.app',
      'https://dunastravel-frontend-vpdk.vercel.app',
    ];
    const configured =
      this.configService.get<string>('corsAllowedOrigins') ??
      this.configService.get<string>('CORS_ALLOWED_ORIGINS') ??
      '';
    const parsedOrigins = configured
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const allowedOrigins = new Set([...defaultOrigins, ...parsedOrigins]);
    if (allowedOrigins.has(origin)) return true;

    if (
      /^https:\/\/dunastravel-[a-z0-9_-]+\.vercel\.app$/i.test(origin) ||
      /^https:\/\/([a-z0-9_-]+\.)?vercel\.app$/i.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/i.test(origin)
    ) {
      return true;
    }

    return false;
  }
}
