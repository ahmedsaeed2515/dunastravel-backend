import { Module } from '@nestjs/common';
import { ToursService } from './tours.service';
import { ToursController } from './tours.controller';
import { TourLandingPagesService } from './tour-landing-pages.service';
import { TourLandingPagesAdminController } from './tour-landing-pages-admin.controller';
import { TourLandingPagesPublicController } from './tour-landing-pages-public.controller';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [],
  controllers: [
    ToursController,
    TourLandingPagesAdminController,
    TourLandingPagesPublicController,
  ],
  providers: [
    ToursService,
    TourLandingPagesService,
    makeCounterProvider({
      name: 'tours_viewed_total',
      help: 'Total number of tours viewed',
    }),
  ],
  exports: [ToursService, TourLandingPagesService],
})
export class ToursModule {}
