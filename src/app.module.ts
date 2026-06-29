import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { envValidationSchema } from './config/env.validation';
import configuration from './config/configuration';
import { AsyncContextService } from './common/logging/async-context.service';
import { JsonLoggerService } from './common/logging/json-logger.service';
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

@Module({
  imports: [
    // Config — global, validates env vars on startup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: false,
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
    // MailModule      ← Phase 8
    // AiModule        ← Phase 9
    // CurrencyModule  ← Phase 10
  ],
  providers: [AsyncContextService, JsonLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
