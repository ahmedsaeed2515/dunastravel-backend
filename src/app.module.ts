import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
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
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AdminReviewsModule } from './modules/admin/admin-reviews/admin-reviews.module';
import { AdminPromotionsModule } from './modules/admin/admin-promotions/admin-promotions.module';
import { AdminCmsModule } from './modules/admin/admin-cms/admin-cms.module';
import { AdminReportsModule } from './modules/admin/admin-reports/admin-reports.module';
import { AdminTemplatesModule } from './modules/admin/admin-templates/admin-templates.module';
import { CmsModule } from './modules/cms/cms.module';
import { UsersModule } from './modules/users/users.module';
import { ToolsModule } from './modules/tools/tools.module';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { PaymentsModule } from './modules/payments/payments.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { PromotionsModule } from './modules/promotions/promotions.module';

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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: parseInt(config.get<string>('THROTTLE_TTL', '60000'), 10),
          limit: parseInt(config.get<string>('THROTTLE_LIMIT', '100'), 10),
        },
      ],
    }),

    // Structured Logging — console only (serverless has read-only FS)
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
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
    PaymentsModule,
    WishlistModule,
    PromotionsModule,
    AdminReviewsModule,
    AdminPromotionsModule,
    AdminCmsModule,
    AdminReportsModule,
    AdminTemplatesModule,
    CmsModule,
    ToolsModule,
  ],
  providers: [
    AsyncContextService,
    JsonLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
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
