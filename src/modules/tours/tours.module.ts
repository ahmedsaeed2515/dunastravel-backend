import { Module } from '@nestjs/common';
import { ToursService } from './tours.service';
import { ToursController } from './tours.controller';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [],
  controllers: [ToursController],
  providers: [
    ToursService,
    makeCounterProvider({
      name: 'tours_viewed_total',
      help: 'Total number of tours viewed',
    }),
  ],
  exports: [ToursService],
})
export class ToursModule {}
