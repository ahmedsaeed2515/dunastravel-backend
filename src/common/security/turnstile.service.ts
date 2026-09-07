import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
  action?: string;
  challengeTs?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly siteverifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate a Turnstile challenge token against Cloudflare's siteverify API.
   *
   * @param token The client-provided Turnstile response token.
   * @param remoteIp Optional client IP address.
   * @param expectedAction Optional expected action to guard against token reuse across actions.
   */
  async validateToken(
    token: string | undefined | null,
    remoteIp?: string,
    expectedAction?: string,
  ): Promise<TurnstileVerificationResult> {
    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    const isProd = nodeEnv === 'production' || nodeEnv === 'staging';
    const skip =
      this.configService.get<boolean>('turnstile.skip') ??
      process.env.SKIP_TURNSTILE === 'true';
    const secretKey =
      this.configService.get<string>('turnstile.secretKey') ||
      process.env.TURNSTILE_SECRET_KEY;

    // In local dev/testing, allow explicit skip or missing secret key
    if (skip || (!secretKey && !isProd)) {
      this.logger.debug(
        'Turnstile verification bypassed due to skip flag or missing secret key in non-production environment.',
      );
      return { success: true };
    }

    if (!secretKey) {
      this.logger.error(
        'Turnstile secret key is not configured in production/staging environment.',
      );
      throw new InternalServerErrorException(
        'CAPTCHA verification service is not properly configured.',
      );
    }

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException(
        'Security challenge token is required. Please complete the verification.',
      );
    }

    // Cloudflare standardized test tokens support (pass / fail simulation in non-prod)
    if (!isProd) {
      if (
        token === '1x0000000000000000000000000000000AA' ||
        token === 'XXXX.DUMMY.PASS'
      ) {
        return { success: true, action: expectedAction };
      }
      if (
        token === '2x0000000000000000000000000000000AA' ||
        token === 'XXXX.DUMMY.FAIL'
      ) {
        throw new BadRequestException(
          'Security challenge validation failed. Please try again.',
        );
      }
    }

    const payload: Record<string, string> = {
      secret: secretKey,
      response: token.trim(),
    };

    if (remoteIp) {
      payload.remoteip = remoteIp;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.siteverifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.warn(
          `Cloudflare Turnstile siteverify HTTP error: ${response.status} ${response.statusText}`,
        );
        throw new BadRequestException(
          'Security challenge validation failed. Please try again.',
        );
      }

      const data = (await response.json()) as {
        success: boolean;
        'error-codes'?: string[];
        challenge_ts?: string;
        hostname?: string;
        action?: string;
        cdata?: string;
      };

      if (!data.success) {
        this.logger.warn(
          `Turnstile challenge rejected: error-codes=${JSON.stringify(data['error-codes'] || [])}`,
        );
        throw new BadRequestException(
          'Security challenge verification failed. Please retry.',
        );
      }

      // Check action binding if specified
      if (expectedAction && data.action && data.action !== expectedAction) {
        this.logger.warn(
          `Turnstile action mismatch: expected '${expectedAction}', received '${data.action}'`,
        );
        throw new BadRequestException(
          'Security challenge validation mismatch for the requested action.',
        );
      }

      return {
        success: true,
        errorCodes: data['error-codes'],
        hostname: data.hostname,
        action: data.action,
        challengeTs: data.challenge_ts,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }

      this.logger.error(
        `Error communicating with Cloudflare Turnstile API: ${err.message}`,
        err.stack,
      );

      // In non-production, fail gracefully if network unreachable during offline dev
      if (!isProd && (err.name === 'AbortError' || err.code === 'ENOTFOUND' || err.name === 'TypeError')) {
        this.logger.warn(
          'Network error contacting Turnstile in non-production; allowing bypass.',
        );
        return { success: true };
      }

      // Production fail-closed
      throw new BadRequestException(
        'Security challenge service unavailable. Please try again momentarily.',
      );
    }
  }
}
