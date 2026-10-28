import { ConfigService } from '@nestjs/config';

/**
 * Normalizes an origin string into standard canonical format:
 * lowercase scheme + '://' + lowercase host + port (omitted if standard 80/443).
 * Returns null if origin is malformed, uses non-http(s) protocol, has trailing dots,
 * contains wildcards, or is literal string 'null'.
 */
export function normalizeOrigin(origin?: string | null): string | null {
  if (!origin || typeof origin !== 'string') return null;
  const trimmed = origin.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    // Reject trailing dot in hostname (e.g. evil.com.)
    if (url.hostname.endsWith('.')) {
      return null;
    }
    // Disallow wildcards in origin
    if (url.hostname.includes('*')) {
      return null;
    }
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validates CORS configuration at startup.
 * In production, CORS_ALLOWED_ORIGINS must be defined, non-empty, and must NOT contain wildcards ('*').
 */
export function validateCorsConfiguration(configService: ConfigService): void {
  const nodeEnv =
    configService.get<string>('nodeEnv') ??
    process.env.NODE_ENV ??
    'development';

  if (nodeEnv === 'production') {
    const rawConfigured =
      configService.get<string>('corsAllowedOrigins') ??
      configService.get<string>('CORS_ALLOWED_ORIGINS') ??
      process.env.CORS_ALLOWED_ORIGINS ??
      '';

    const configuredList = rawConfigured
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (configuredList.length === 0) {
      throw new Error(
        '[FATAL CORS SECURITY] CORS_ALLOWED_ORIGINS must be defined and non-empty in production.',
      );
    }

    if (configuredList.some((o) => o === '*' || o.includes('*'))) {
      throw new Error(
        '[FATAL CORS SECURITY] Wildcard "*" is strictly forbidden in CORS_ALLOWED_ORIGINS in production.',
      );
    }
  }
}

const LOCAL_DEVELOPMENT_ORIGIN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

const STAGING_PREVIEW_PATTERNS = [
  /^https:\/\/(?:dunas-travel|dunastravel)-(?:frontend|dashbord|dashboard|tours)(?:-[a-z0-9-]+)?-ahmedsaeed2515-1865s-projects\.vercel\.app$/i,
];

export function isAllowedBrowserOrigin(
  origin: string | undefined | null,
  configService: ConfigService,
): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const nodeEnv =
    configService.get<string>('nodeEnv') ??
    process.env.NODE_ENV ??
    'development';

  const rawConfigured =
    configService.get<string>('corsAllowedOrigins') ??
    configService.get<string>('CORS_ALLOWED_ORIGINS') ??
    process.env.CORS_ALLOWED_ORIGINS ??
    '';

  const configuredOrigins = new Set(
    rawConfigured
      .split(',')
      .map((entry) => normalizeOrigin(entry))
      .filter((entry): entry is string => entry !== null),
  );

  // In production, allow ONLY exact origins listed in CORS_ALLOWED_ORIGINS
  if (nodeEnv === 'production') {
    return configuredOrigins.has(normalized);
  }

  // In non-production environments (development / test / staging):
  if (configuredOrigins.has(normalized)) {
    return true;
  }

  if (LOCAL_DEVELOPMENT_ORIGIN.test(normalized)) {
    return true;
  }

  if (nodeEnv === 'staging') {
    return STAGING_PREVIEW_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  return false;
}
