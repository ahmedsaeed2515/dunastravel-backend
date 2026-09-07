import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TurnstileService } from './turnstile.service';
import { TURNSTILE_ACTION_KEY } from './require-turnstile.decorator';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly turnstileService?: TurnstileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.turnstileService) {
      return true;
    }

    const action = this.reflector.getAllAndOverride<string | null>(
      TURNSTILE_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();

    // Extract token from standard headers or payload
    const token =
      (request.headers['cf-turnstile-token'] as string) ||
      (request.headers['x-turnstile-token'] as string) ||
      request.body?.turnstileToken ||
      request.body?.cfTurnstileToken;

    // Extract remote client IP
    const forwardedFor = request.headers['x-forwarded-for'];
    const remoteIp =
      (typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]?.trim()
          : undefined) || request.ip;

    await this.turnstileService.validateToken(
      token,
      remoteIp,
      action ?? undefined,
    );

    return true;
  }
}
