import { Module, forwardRef } from '@nestjs/common';
import { AdminTailorMadeController } from './admin-tailor-made.controller';
import { AdminTailorMadeService } from './admin-tailor-made.service';
import { BookingsModule } from '../../bookings/bookings.module';

@Module({
  imports: [forwardRef(() => BookingsModule)],
  controllers: [AdminTailorMadeController],
  providers: [AdminTailorMadeService],
  exports: [AdminTailorMadeService],
})
export class AdminTailorMadeModule {}
