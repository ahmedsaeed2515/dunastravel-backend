import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

let cachedApp: NestExpressApplication;

async function bootstrapServerless(): Promise<express.Express> {
  if (!cachedApp) {
    if (process.env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nestjs');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
      });
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      // Use built-in logger to avoid file-write crash in serverless environment
      logger: ['log', 'error', 'warn'],
      rawBody: true,
    });

    const configService = app.get(ConfigService);
    app.enableShutdownHooks();
    app.set('trust proxy', 1);

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      }),
    );
    app.use(cookieParser());
    app.use(compression({ threshold: 1024 }));
    app.use(
      express.json({
        limit: '1mb',
        verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );
    app.use(
      express.urlencoded({
        extended: true,
        limit: '1mb',
        verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );

    // Safe CORS — read from env, never crash
    const rawOrigins =
      process.env.CORS_ALLOWED_ORIGINS ||
      'https://www.dunastravel.com,https://admin.dunastravel.com';
    const allowedOrigins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Idempotency-Key',
        'X-CSRF-Token',
      ],
      maxAge: 86400,
    });

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    const { HttpExceptionFilter } =
      await import('./common/filters/http-exception.filter');
    const { PrismaExceptionFilter } =
      await import('./common/filters/prisma-exception.filter');
    const { TransformInterceptor } =
      await import('./common/interceptors/transform.interceptor');

    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaExceptionFilter(),
    );
    app.useGlobalInterceptors(
      new TransformInterceptor(),
      new TimeoutInterceptor(configService),
      new RequestLoggingInterceptor(),
    );

    await app.init();
    cachedApp = app;
  }

  return cachedApp.getHttpAdapter().getInstance() as express.Express;
}

export default async function handler(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  try {
    const server = await bootstrapServerless();
    server(req, res);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Vercel] Bootstrap Error:', err?.message, err?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        message: 'NestJS bootstrap failed',
        error: err?.message ?? 'Unknown error',
      });
    }
  }
}
