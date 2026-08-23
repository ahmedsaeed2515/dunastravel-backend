import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import * as Sentry from '@sentry/nestjs';

async function bootstrap(): Promise<void> {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
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

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 5000;
  const frontendUrl = configService.get<string>('frontendUrl');
  const nodeEnv = configService.get<string>('nodeEnv');

  // Replace NestJS default logger with JsonLoggerService for structured logging
  app.useLogger(app.get(JsonLoggerService));

  // Enable graceful shutdown hooks (e.g. for Prisma)
  app.enableShutdownHooks();

  // ─── Trust Proxy ──────────────────────────────────────────────────────────
  app.set(
    'trust proxy',
    configService.get<number>('trustProxyHops') ?? 0,
  );

  // ─── Security Middleware ───────────────────────────────────────────────────
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

  // ─── Compression & Limits ──────────────────────────────────────────────────
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );

  // Body size limits (1mb json, 1MB urlencoded)
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        if (req.originalUrl.includes('/payments/webhook/')) {
          req.rawBody = Buffer.from(buf);
        }
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: '1mb',
    }),
  );

  // ─── CORS ─────────────────────────────────────────────────────────────────
  const defaultOrigins = [
    'https://www.dunastravel.com',
    'https://dunastravel.com',
    'https://admin.dunastravel.com',
    'https://dunastravel-dashbord.vercel.app',
    'https://dunastravel-dashboard.vercel.app',
    'https://dunastravel-tours.vercel.app',
    'https://dunastravel-frontend-vpdk.vercel.app',
    'https://dunastravel-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  const corsAllowedOrigins =
    configService.get<string>('corsAllowedOrigins') ?? '';
  const parsedOrigins = corsAllowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const staticOrigins = new Set([...defaultOrigins, ...parsedOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (staticOrigins.has(origin)) {
        return callback(null, true);
      }
      if (
        /^https:\/\/dunastravel(?:-[a-z0-9_-]+)?\.vercel\.app$/i.test(
          origin,
        ) ||
        /^http:\/\/localhost(:\d+)?$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
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

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // ─── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // ─── Start Server ─────────────────────────────────────────────────────────
  await app.listen(port);
  logger.log(`🚀 Dunas Travel API → http://localhost:${port}/api`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🔗 CORS Origin: ${frontendUrl}`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  if (process.env.NODE_ENV === 'production') {
    logger.error('Failed to start application');
  } else {
    logger.error(
      'Failed to start application',
      err instanceof Error ? err.stack : String(err),
    );
  }
  process.exit(1);
});
