import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ToursModule } from '../tours/tours.module';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [ToursModule],
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
