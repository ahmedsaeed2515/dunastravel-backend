import { ConfigService } from '@nestjs/config';

const PRODUCTION_ORIGINS = new Set([
  'https://www.dunastravel.com',
  'https://dunastravel.com',
  'https://admin.dunastravel.com',
  'https://dunastravel-dashbord.vercel.app',
  'https://dunastravel-dashboard.vercel.app',
  'https://dunas-travel-dashbord.vercel.app',
  'https://dunas-travel-dashboard.vercel.app',
  'https://dunastravel-tours.vercel.app',
  'https://dunas-travel-tours.vercel.app',
  'https://dunastravel-frontend-vpdk.vercel.app',
  'https://dunastravel-frontend.vercel.app',
  'https://dunas-travel-frontend.vercel.app',
]);

const OWNED_VERCEL_PREVIEWS = [
  /^https:\/\/(?:dunas-travel|dunastravel)-(?:frontend|dashbord|dashboard|tours)(?:-[a-z0-9-]+)?(?:-ahmedsaeed2515-1865s-projects)?\.vercel\.app$/i,
  /^https:\/\/[a-z0-9-]+-ahmedsaeed2515-1865s-projects\.vercel\.app$/i,
];

const LOCAL_DEVELOPMENT_ORIGIN =
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export function isAllowedBrowserOrigin(
  origin: string,
  configService: ConfigService,
): boolean {
  const configured =
    configService.get<string>('corsAllowedOrigins') ??
    configService.get<string>('CORS_ALLOWED_ORIGINS') ??
    '';
  const configuredOrigins = configured
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const normalizedOrigin = origin.replace(/\/$/, '');

  if (
    PRODUCTION_ORIGINS.has(normalizedOrigin) ||
    configuredOrigins.includes(normalizedOrigin) ||
    OWNED_VERCEL_PREVIEWS.some((pattern) => pattern.test(normalizedOrigin))
  ) {
    return true;
  }

  const nodeEnv =
    configService.get<string>('nodeEnv') ??
    process.env.NODE_ENV ??
    'development';
  return (
    nodeEnv !== 'production' &&
    nodeEnv !== 'staging' &&
    LOCAL_DEVELOPMENT_ORIGIN.test(normalizedOrigin)
  );
}
