import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
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
import { isAllowedBrowserOrigin } from './common/security/allowed-origin.util';

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
  app.set('trust proxy', configService.get<number>('trustProxyHops') ?? 0);

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
        if (req.originalUrl.includes('webhook')) {
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
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedBrowserOrigin(origin, configService)) {
        return callback(null, true);
      }
      return callback(null, false);
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
      'X-Request-Id',
    ],
    maxAge: 86400,
  });

  // ─── Global Prefix ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', { exclude: ['/'] });
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
