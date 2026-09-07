import { SetMetadata } from '@nestjs/common';

export const TURNSTILE_ACTION_KEY = 'TURNSTILE_ACTION';

/**
 * Decorator to require Cloudflare Turnstile token validation on an endpoint.
 *
 * @param action Optional action name (e.g. 'register', 'resend_verification', 'forgot_password')
 */
export const RequireTurnstile = (action?: string) =>
  SetMetadata(TURNSTILE_ACTION_KEY, action ?? null);
