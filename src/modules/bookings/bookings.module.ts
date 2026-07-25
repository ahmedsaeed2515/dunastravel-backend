import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ToursModule } from '../tours/tours.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { AvailabilityModule } from '../availability/availability.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    ToursModule,
    PaymentsModule,
    PricingModule,
    AvailabilityModule,
    CommissionsModule,
  ],

  controllers: [BookingsController],
  providers: [
    BookingsService,
    makeCounterProvider({
      name: 'bookings_created_total',
      help: 'Total number of bookings created',
    }),
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
