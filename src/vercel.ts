import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

let cachedApp: NestExpressApplication;

async function bootstrapServerless(): Promise<express.Express> {
  if (!cachedApp) {
    if (process.env.SENTRY_DSN) {
      const Sentry = await import('@sentry/nestjs');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request) {
            event.request.headers = undefined;
            event.request.cookies = undefined;
            event.request.data = undefined;
            event.request.query_string = undefined;
          }
          if (event.user) {
            event.user = { id: event.user.id };
          }
          return event;
        },
      });
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      // Use built-in logger to avoid file-write crash in serverless environment
      logger: ['log', 'error', 'warn'],
      bodyParser: false,
    });

    const configService = app.get(ConfigService);
    app.enableShutdownHooks();
    app.set(
      'trust proxy',
      configService.get<number>('trustProxyHops') ?? 1,
    );

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

    // Safe CORS — read from config/env, fallback to default origins, never crash
    const rawOrigins =
      configService.get<string>('corsAllowedOrigins') ||
      process.env.CORS_ALLOWED_ORIGINS ||
      'https://www.dunastravel.com,https://admin.dunastravel.com';
    const allowedOrigins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const corsOrigin =
      allowedOrigins.length > 0
        ? allowedOrigins
        : ['https://www.dunastravel.com', 'https://admin.dunastravel.com'];

    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Idempotency-Key',
        'X-CSRF-Token',
        'X-Guest-Token',
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
    app.useGlobalFilters(
      new HttpExceptionFilter(),
      new PrismaExceptionFilter(),
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
  if (req.url === '/favicon.ico') {
    res.status(204).end();
    return;
  }

  try {
    const server = await bootstrapServerless();
    server(req, res);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[Vercel] Bootstrap Error:', err?.message, err?.stack);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        message: 'Service initialization failed: ' + (err?.message || 'Unknown error'),
      });
    }
  }
}
