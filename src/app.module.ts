import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { envValidationSchema } from './config/env.validation';
import configuration from './config/configuration';
import { AsyncContextService } from './common/logging/async-context.service';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { CorrelationIdMiddleware } from './common/logging/correlation-id.middleware';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ToursModule } from './modules/tours/tours.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { TransportationModule } from './modules/transportation/transportation.module';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AdminTemplatesModule } from './modules/admin/admin-templates/admin-templates.module';
import { CmsModule } from './modules/cms/cms.module';
import { UsersModule } from './modules/users/users.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { PaymentsModule } from './modules/payments/payments.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { DestinationsModule } from './modules/destinations/destinations.module';
import { BlogsModule } from './modules/blogs/blogs.module';
import { FaqModule } from './modules/faq/faq.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { JourneyMapsModule } from './modules/journey-maps/journey-maps.module';
import { RedisThrottlerStorage } from './common/security/redis-throttler-storage.service';
import { RedisKeyvStore } from './common/cache/redis-keyv.store';
import Keyv from 'keyv';

import { InAppNotificationsModule } from './modules/in-app-notifications/in-app-notifications.module';
import { HotelsModule } from './modules/hotels/hotels.module';

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
      useFactory: (config: ConfigService) => ({
        storage: new RedisThrottlerStorage(
          config.getOrThrow<string>('REDIS_URL'),
        ),
        throttlers: [
          {
            ttl: parseInt(
              config.get<string>('THROTTLE_TTL', '60000'),
              10,
            ),
            limit: parseInt(
              config.get<string>('THROTTLE_LIMIT', '100'),
              10,
            ),
          },
        ],
      }),
    }),

    // Structured Logging — console only
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

    // Shared Redis cache. Security-sensitive idempotency must never depend on
    // per-instance memory in a horizontally scaled deployment.
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        const store = new RedisKeyvStore(
          config.getOrThrow<string>('REDIS_URL'),
        );
        return {
          stores: new Keyv({
            store,
            namespace: 'dunas-cache',
            throwOnErrors: true,
          }),
          ttl: 300_000,
        };
      },
      inject: [ConfigService],
    }),

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

    PrismaModule,
    HealthModule,
    PrometheusModule.register(),

    // Feature modules
    AdminModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    PricingModule,
    TransportationModule,
    InvoicesModule,
    InquiriesModule,
    NotificationsModule,
    ContactSubmissionsModule,
    MediaModule,
    CompaniesModule,
    WalletsModule,
    CommissionsModule,
    AiModule,
    CurrencyModule,
    AuditModule,
    AgentsModule,
    PaymentsModule,
    WishlistModule,
    PromotionsModule,
    AdminTemplatesModule,
    CmsModule,
    SettingsModule,
    AnalyticsModule,
    DashboardModule,
    AvailabilityModule,
    AgenciesModule,
    DestinationsModule,
    BlogsModule,
    FaqModule,
    ReviewsModule,
    UsersModule,
    JourneyMapsModule,
    InAppNotificationsModule,
    HotelsModule,
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
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
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
