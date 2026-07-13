import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import * as Sentry from '@sentry/nestjs';

let cachedApp: NestExpressApplication;

async function bootstrapServerless(): Promise<any> {
  if (!cachedApp) {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
      });
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['log', 'error', 'warn', 'debug'],
      rawBody: true,
    });

    const configService = app.get(ConfigService);
    app.useLogger(app.get(JsonLoggerService));
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

    app.use(express.json({ limit: '1mb', verify: (req: any, res, buf) => { req.rawBody = buf; } }));
    app.use(express.urlencoded({ extended: true, limit: '1mb', verify: (req: any, res, buf) => { req.rawBody = buf; } }));

    const corsAllowedOrigins = configService.get<string>('corsAllowedOrigins') || process.env.CORS_ALLOWED_ORIGINS || 'https://www.dunastravel.com,https://admin.dunastravel.com';
    const allowedOrigins = corsAllowedOrigins.split(',').map((o) => o.trim());

    app.enableCors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Idempotency-Key', 'X-CSRF-Token'
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

    const { HttpExceptionFilter } = await import('./common/filters/http-exception.filter');
    const { PrismaExceptionFilter } = await import('./common/filters/prisma-exception.filter');
    const { TransformInterceptor } = await import('./common/interceptors/transform.interceptor');
    
    app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
    app.useGlobalInterceptors(
      new TransformInterceptor(),
      new TimeoutInterceptor(configService),
      new RequestLoggingInterceptor(),
    );

    await app.init();
    cachedApp = app;
  }
  
  return cachedApp.getHttpAdapter().getInstance();
}

export default async function (req: any, res: any) {
  try {
    const server = await bootstrapServerless();
    return server(req, res);
  } catch (error: any) {
    console.error("VERCEL BOOTSTRAP ERROR:", error);
    return res.status(500).json({
      message: "NestJS Bootstrap Failed",
      error: error.message,
      stack: error.stack
    });
  }
}
