import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { envValidationSchema } from './config/env.validation';
import configuration from './config/configuration';
import { AsyncContextService } from './common/logging/async-context.service';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { CorrelationIdMiddleware } from './common/logging/correlation-id.middleware';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ToursModule } from './modules/tours/tours.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ContactSubmissionsModule } from './modules/contact-submissions/contact-submissions.module';
import { AdminModule } from './modules/admin/admin.module';
import { MediaModule } from './modules/media/media.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { AiModule } from './modules/ai/ai.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { AuditModule } from './modules/audit/audit.module';
import { AgentsModule } from './modules/agents/agents.module';
import { CompanySelfModule } from './modules/company-self/company-self.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { CsrfGuard } from './common/guards/csrf.guard';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    // Config — global, validates env vars on startup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Rate limiting — global, 100 req/min per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // Structured Logging
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    }),

    // Redis Caching
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => ({
        // store: redisStore, // Disabled for local audit to use memory store
        host: config.get<string>('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
        ttl: 300, // 5 minutes default
      }),
      inject: [ConfigService],
    }),

    // Cron jobs — needed by CurrencyModule (Phase 10)
    ScheduleModule.forRoot(),

    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Database — global provider, available in all modules
    PrismaModule,

    // Health check
    HealthModule,

    // Prometheus Metrics
    PrometheusModule.register(),

    // Feature modules — added in later phases:
    AdminModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    InvoicesModule,
    InquiriesModule,
    NotificationsModule,
    ContactSubmissionsModule,
    MediaModule,
    CompaniesModule,
    WalletsModule,
    CommissionsModule,
    // MailModule      ← Phase 8
    AiModule,
    CurrencyModule,
    AuditModule,
    AgentsModule,
    CompanySelfModule,
    PaymentsModule,
  ],
  providers: [
    AsyncContextService,
    JsonLoggerService,
    TimeoutInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
