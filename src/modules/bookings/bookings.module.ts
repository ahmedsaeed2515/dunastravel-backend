import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ToursModule } from '../tours/tours.module';
import { PaymentsModule } from '../payments/payments.module';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [ToursModule, PaymentsModule],
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
export class BookingsModule implements OnModuleInit {
  private readonly logger = new Logger(BookingsModule.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(
        'CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1 INCREMENT 1;',
      );
      this.logger.log('invoice_seq PostgreSQL sequence ensured');
    } catch (error) {
      this.logger.error('Failed to ensure invoice_seq sequence', error);
    }
  }
}
