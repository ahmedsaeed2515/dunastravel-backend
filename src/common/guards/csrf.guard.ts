import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Exempt Stripe webhook endpoints
    if (request.url.includes('/payments/webhook')) {
      return true;
    }

    // Only check state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Exempt requests authenticated explicitly via Bearer token (non-browser-ambient auth)
    const authHeader = request.headers['authorization'];
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    ) {
      return true;
    }

    const csrfCookie = (request.cookies as Record<string, string>)?.[
      'csrf_token'
    ];
    const csrfHeader = request.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
